import test, { after, before, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import {
  initTestDatabase,
  concludeTesting,
  clearTestData,
  Models,
} from "../../../server/database/index.js";

import * as User from "../../../server/database/user.js";
import * as Project from "../../../server/database/project.js";

import { portBindings } from "../../../server/caddy/caddy.js";
import { createDockerProject, createUser, tryFor } from "../../test-helpers.js";
import { closeReader } from "../../../setup/utils.js";
import { scrubDateTime } from "../../../helpers.js";
import { randomUUID } from "node:crypto";

/*
id int
name text, not null, unique
slug text, not null, unique
description text, nullable
created_at
updated_at
*/

/*
links to a user via ProjectAccess (user_id, project_id, access_level)
*/

function createProject(
  projectName = randomUUID(),
  usernameOrUser = randomUUID(),
) {
  let user;

  if (typeof usernameOrUser === "string") {
    user = createUser(usernameOrUser);
    // The user must be enabled for various Project calls to succeed
    User.enableUser(user);
  } else {
    user = usernameOrUser;
  }

  const project = Project.createProjectForUser(user, projectName);
  return project;
}

function createStarterProject(projectName, usernameOrUser) {
  const project = createProject(projectName, usernameOrUser);
  Models.StarterProject.create({ project_id: project.id });
  return project;
}

describe(`project testing`, async () => {
  before(async () => await initTestDatabase());
  beforeEach(() => clearTestData());
  after(() => {
    concludeTesting();
    closeReader();
  });

  test(`getMostRecentProjects`, () => {
    let projects = Project.getMostRecentProjects(5);
    assert.equal(projects.length, 0);

    createProject();

    projects = Project.getMostRecentProjects(5);
    assert.equal(projects.length, 1);
  });

  test(`copyProjectSettings`, () => {
    const project1 = createProject(`test-project`);
    Project.updateSettingsForProject(project1, { run_script: "npm start" });

    const project2 = createProject(`new-test-project`);
    Project.copyProjectSettings(project1, project2);
    assert.equal(project1.settings.run_script, "npm start");
    assert.equal(project1.settings.run_script, project2.settings.run_script);
  });

  test(`createProjectForUser`, () => {
    const user = createUser();
    const project = Project.createProjectForUser(user, `new test project`);
    assert.equal(project.name, `new test project`);
    assert.equal(Project.getAllProjects().length, 1);
  });

  test(`deleteProjectForUser`, () => {
    const user = createUser();
    const project = createProject(`test-project`, user);
    Project.deleteProjectForUser(user, project);
    assert.equal(Project.getAllProjects().length, 0);
  });

  test(`deleteProjectForUser as admin call`, () => {
    const project = createProject(`new test project`);
    assert.equal(project.name, `new test project`);
    assert.equal(Project.getAllProjects().length, 1);
    Project.deleteProjectForUser(null, project, true);
    assert.equal(Project.getAllProjects().length, 0);
  });

  test(`getAccessFor`, () => {
    const user = createUser();
    const project = createProject(`test-project`, user);
    const accessLevel = Project.getAccessFor(user, project);
    assert.equal(accessLevel, Project.OWNER);
  });

  test(`getAllProjects`, () => {
    createStarterProject();
    const projects = Project.getAllProjects();
    assert.equal(projects.length, 0);
    const withStarters = Project.getAllProjects(false);
    assert.equal(withStarters.length, 1);
  });

  test(`getOwnedProjectsForUser`, () => {
    const user = createUser();
    createProject(`test-project`, user);
    const projects = Project.getOwnedProjectsForUser(user);
    assert.equal(projects.length, 1);
  });

  test(`getProject`, () => {
    createProject(`test-project`);
    // we already test this all over the place, but not this:
    const project = Project.getProject(`test-project`, false);
    assert.equal(project.settings, undefined);
  });

  test(`getProjectEnvironmentVariables`, () => {
    const project = createProject();
    Project.updateSettingsForProject(project, {
      env_vars: `FIRST=first\nSECOND=second`,
    });
    const vars = Project.getProjectEnvironmentVariables(project);
    assert.deepEqual(vars, { FIRST: `first`, SECOND: `second` });
  });

  test(`suspensions`, () => {
    const project = createProject();
    Project.suspendProject(project, `because we're testing`);
    const s = Project.getProjectSuspensions(project);
    assert.equal(s.length, 1);
    let suspended = Project.isProjectSuspended(project);
    assert.equal(suspended, true);
    Project.unsuspendProject(s[0].id);
    const t = Project.getProjectSuspensions(project);
    assert.equal(t.length, 0);
    const u = Project.getProjectSuspensions(project, true);
    assert.equal(u.length, 1);
    suspended = Project.isProjectSuspended(project);
    assert.equal(suspended, false);
  });

  test(`getProjectListForUser`, () => {
    const user = createUser();
    let list = Project.getProjectListForUser(user);
    assert.equal(list.length, 0);
    createProject(`new test project 1`, user);
    createProject(`new test project 2`, user);
    createProject(`new test project 3`, user);
    list = Project.getProjectListForUser(user);
    assert.equal(list.length, 3);
  });

  test(`getStarterProjects`, () => {
    createStarterProject();
    const starters = Project.getStarterProjects();
    assert.equal(starters.length, 1);
  });

  test(`projectSuspendedThroughOwner`, () => {
    const user = createUser();
    const project = createProject(`test-project`, user);
    const s = User.suspendUser(user, `testing`);
    let suspended = Project.projectSuspendedThroughOwner(project);
    assert.equal(suspended, true);
    User.unsuspendUser(s.id);
    suspended = Project.projectSuspendedThroughOwner(project);
    assert.equal(suspended, false);
  });

  test(`recordProjectRemix`, () => {
    const user = createUser();
    const starter = createStarterProject(`starter`, user);
    const p1 = createProject(`project-1`, user);
    Project.recordProjectRemix(starter, p1);

    const p2 = createProject(`new test project`, user);
    Project.recordProjectRemix(p1, p2);

    const chain = Project.getProjectRemixChain(p2);
    assert.deepEqual(chain, [starter.id, p1.id, p2.id]);
  });

  test(`runProject (static)`, async () => {
    const slug = `run-static-test-project`;
    const project = createProject(slug);
    project.updated_at = scrubDateTime(new Date(0).toISOString());
    await Project.runProject(project);
    const found = await tryFor(async () => {
      const { port } = portBindings[project.slug];
      const website = `http://localhost:${port}`;
      await fetch(website).then((r) => r.text());
      return true;
    });
    Project.stopProject(project);
    assert.equal(found, true);
  });

  test(`runProject (docker)`, async () => {
    const { res, cleanup } = await createDockerProject();
    const { project } = res.locals.lookups;
    const found = await tryFor(async () => {
      const { port } = portBindings[project.slug];
      const website = `http://localhost:${port}`;
      await fetch(website).then((r) => r.text());
      return true;
    });
    await cleanup();
    assert.equal(found, true);
  });

  test(`touch`, async () => {
    const slug = `run-touch-test-project`;
    const project = createProject(slug);
    project.updated_at = scrubDateTime(new Date(0).toISOString());
    await Project.touch(project);
    const found = await tryFor(async () => {
      const { port } = portBindings[project.slug];
      const website = `http://localhost:${port}`;
      await fetch(website).then((r) => r.text());
      return true;
    });
    Project.stopProject(project);
    assert.equal(found, true);
  });
});
