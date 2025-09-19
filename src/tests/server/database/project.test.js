import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { resolve, join } from "node:path";
import {
  initTestDatabase,
  concludeTesting,
} from "../../../server/database/index.js";

import * as User from "../../../server/database/user.js";
import * as Project from "../../../server/database/project.js";

import { portBindings } from "../../../server/caddy/caddy.js";
import { createDockerProject, tryFor } from "../../test-helpers.js";
import { closeReader } from "../../../setup/utils.js";
import { scrubDateTime, ROOT_DIR } from "../../../helpers.js";

import dotenv from "@dotenvx/dotenvx";
const envPath = resolve(join(ROOT_DIR, `.env`));
dotenv.config({ quiet: true, path: envPath });

describe(`project testing`, async () => {
  before(async () => await initTestDatabase());
  after(() => {
    concludeTesting();
    closeReader();
  });

  test(`getMostRecentProjects`, () => {
    const projects = Project.getMostRecentProjects(5);
    assert.equal(projects.length, 1);
  });

  test(`copyProjectSettings`, () => {
    const user = User.getUser(`test-user`);
    const project1 = Project.getProject(`test-project`);
    Project.createProjectForUser(user, `new test project`);
    const project2 = Project.getProject(`new-test-project`);
    Project.copyProjectSettings(project1, project2);
    assert.equal(project1.settings.run_script, project2.settings.run_script);
    Project.deleteProjectForUser(null, project2, true);
  });

  test(`createProjectForUser`, () => {
    const user = User.getUser(`test-user`);
    const project = Project.createProjectForUser(user, `new test project`);
    assert.equal(project.name, `new test project`);
    assert.equal(Project.getAllProjects().length, 2);
  });

  test(`deleteProjectForUser`, () => {
    const user = User.getUser(`test-user`);
    const project = Project.getProject(`new-test-project`);
    Project.deleteProjectForUser(user, project);
    assert.equal(Project.getAllProjects().length, 1);
  });

  test(`deleteProjectForUser as admin call`, () => {
    const user = User.getUser(`test-user`);
    const project = Project.createProjectForUser(user, `new test project`);
    assert.equal(project.name, `new test project`);
    assert.equal(Project.getAllProjects().length, 2);
    Project.deleteProjectForUser(null, project, true);
    assert.equal(Project.getAllProjects().length, 1);
  });

  test(`getAccessFor`, () => {
    const user = User.getUser(`test-user`);
    const project = Project.getProject(`test-project`);
    const accessLevel = Project.getAccessFor(user, project);
    assert.equal(accessLevel, Project.OWNER);
  });

  test(`getAllProjects`, () => {
    const projects = Project.getAllProjects();
    assert.equal(projects.length, 1);
    const withStarters = Project.getAllProjects(false);
    assert.equal(withStarters.length, 2);
  });

  test(`getOwnedProjectsForUser`, () => {
    const user = User.getUser(`test-user`);
    const projects = Project.getOwnedProjectsForUser(user);
    assert.equal(projects.length, 1);
  });

  test(`getProject`, () => {
    // we already test this all over the place, but not this:
    const project = Project.getProject(`test-project`, false);
    assert.equal(project.settings, undefined);
  });

  test(`getProjectEnvironmentVariables`, () => {
    const project = Project.getProject(`test-project`);
    Project.updateSettingsForProject(project, {
      env_vars: `FIRST=first\nSECOND=second`,
    });
    const vars = Project.getProjectEnvironmentVariables(project);
    assert.deepEqual(vars, { FIRST: `first`, SECOND: `second` });
  });

  test(`suspensions`, () => {
    const user = User.getUser(`test-user`);
    const project = Project.getOwnedProjectsForUser(user)[0];
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
    const user = User.getUser(`test-user`);
    let list = Project.getProjectListForUser(user);
    assert.equal(list.length, 1);
    const p1 = Project.createProjectForUser(user, `new test project 1`);
    const p2 = Project.createProjectForUser(user, `new test project 2`);
    const p3 = Project.createProjectForUser(user, `new test project 3`);
    list = Project.getProjectListForUser(user);
    assert.equal(list.length, 4);
    [p1, p2, p3].forEach((p) => Project.deleteProjectForUser(null, p, true));
  });

  test(`getStarterProjects`, () => {
    const starters = Project.getStarterProjects();
    assert.equal(starters.length, 1);
  });

  test(`projectSuspendedThroughOwner`, () => {
    const user = User.getUser(`test-user`);
    const project = Project.getOwnedProjectsForUser(user)[0];
    const s = User.suspendUser(user, `testing`);
    let suspended = Project.projectSuspendedThroughOwner(project);
    assert.equal(suspended, true);
    User.unsuspendUser(s.id);
    suspended = Project.projectSuspendedThroughOwner(project);
    assert.equal(suspended, false);
  });

  test(`recordProjectRemix`, () => {
    const user = User.getUser(`test-user`);
    const starter = Project.getStarterProjects()[0];
    const p1 = Project.getOwnedProjectsForUser(user)[0];
    const p2 = Project.createProjectForUser(user, `new test project`);
    Project.recordProjectRemix(p1, p2);
    const chain = Project.getProjectRemixChain(p2);
    assert.deepEqual(chain, [starter.id, p1.id, p2.id]);
  });

  test(`runProject (static)`, async () => {
    const user = User.getUser(`test-user`);
    const slug = `run-static-test-project`;
    const project = Project.createProjectForUser(user, slug);
    project.updated_at = scrubDateTime(new Date(0).toISOString());
    await Project.runProject(project);
    const found = await tryFor(async () => {
      const { port } = portBindings[project.slug];
      const website = `http://localhost:${port}`;
      try {
        await fetch(website).then((r) => r.text());
      } catch (e) {
        throw e;
      }
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
      try {
        await fetch(website).then((r) => r.text());
      } catch (e) {
        throw e;
      }
      return true;
    });
    await cleanup();
    assert.equal(found, true);
  });

  test(`touch`, async () => {
    const user = User.getUser(`test-user`);
    const slug = `run-touch-test-project`;
    const project = Project.createProjectForUser(user, slug);
    project.updated_at = scrubDateTime(new Date(0).toISOString());
    await Project.touch(project);
    const found = await tryFor(async () => {
      const { port } = portBindings[project.slug];
      const website = `http://localhost:${port}`;
      try {
        await fetch(website).then((r) => r.text());
      } catch (e) {
        throw e;
      }
      return true;
    });
    Project.stopProject(project);
    assert.equal(found, true);
  });
});
