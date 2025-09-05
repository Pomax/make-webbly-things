import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { resolve, join } from "node:path";
import {
  initTestDatabase,
  concludeTesting,
} from "../../../server/database/models.js";
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
  export function copyProjectSettings(source, target) {
  export function createProjectForUser(user, projectName) {
  export function deleteProjectForUser(user, project, adminCall) {
  export function getAccessFor(user, project) {
  export function getAllProjects(omitStarters = true) {
  export function getOwnedProjectsForUser(userNameOrId) {
  export function getProject(slugOrId, withSettings = true) {
  export function getProjectEnvironmentVariables(project) {
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
});
