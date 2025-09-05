import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { resolve, join } from "node:path";
import {
  initTestDatabase,
  concludeTesting,
} from "../../../server/database/models.js";
import * as User from "../../../server/database/user.js";
import * as Project from "../../../server/database/project.js";

import dotenv from "@dotenvx/dotenvx";
const envPath = resolve(
  join(import.meta.dirname, `..`, `..`, `..`, `..`, `.env`)
);
dotenv.config({ quiet: true, path: envPath });

describe(`project testing`, async () => {
  before(async () => await initTestDatabase());
  after(() => concludeTesting());

  /*
  export function getProjectSuspensions(project, includeOld = false) {
  export function getProjectListForUser(userNameOrId) {
  export function getStarterProjects() {
  export function isProjectSuspended(project) {
  export function isStarterProject(project) {
  export function projectSuspendedThroughOwner(project) {
  export function recordProjectRemix(original, newProject) {
  export function runProject(project) {
  export function suspendProject(project, reason, notes = ``) {
  export function touch(project) {
  export function unsuspendProject(suspensionId) {
  export function updateSettingsForProject(project, settings) {
  */

  test(`getMostRecentProjects`, () => {
    const projects = Project.getMostRecentProjects(5);
    assert.equal(projects.length, 1);
  });

  test(`copyProjectSettings`, () => {
    const user = User.getUser(`test user`);
    const project1 = Project.getProject(`test-project`);
    Project.createProjectForUser(user, `new test project`);
    const project2 = Project.getProject(`new-test-project`);
    Project.copyProjectSettings(project1, project2);
    assert.equal(project1.settings.run_script, project2.settings.run_script);
    Project.deleteProjectForUser(null, project2, true);
  });

  test(`createProjectForUser`, () => {
    const user = User.getUser(`test user`);
    const project = Project.createProjectForUser(user, `new test project`);
    assert.equal(project.name, `new test project`);
    assert.equal(Project.getAllProjects().length, 2);
  });

  test(`deleteProjectForUser`, () => {
    const user = User.getUser(`test user`);
    const project = Project.getProject(`new-test-project`);
    Project.deleteProjectForUser(user, project);
    assert.equal(Project.getAllProjects().length, 1);
  });

  test(`deleteProjectForUser as admin call`, () => {
    const user = User.getUser(`test user`);
    const project = Project.createProjectForUser(user, `new test project`);
    assert.equal(project.name, `new test project`);
    assert.equal(Project.getAllProjects().length, 2);
    Project.deleteProjectForUser(null, project, true);
    assert.equal(Project.getAllProjects().length, 1);
  });

  test(`getAccessFor`, () => {
    const user = User.getUser(`test user`);
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
    const user = User.getUser(`test user`);
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
});
