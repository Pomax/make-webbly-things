import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { resolve, join } from "node:path";
import {
  initTestDatabase,
  concludeTesting,
  Models,
} from "../../../../../server/database/models.js";
import * as Project from "../../../../../server/database/project.js";
import * as User from "../../../../../server/database/user.js";
import * as Middleware from "../../../../../server/routing/v1/projects/middleware.js";

import dotenv from "@dotenvx/dotenvx";
const envPath = resolve(
  join(import.meta.dirname, `..`, `..`, `..`, `..`, `..`, `..`, `.env`)
);
dotenv.config({ quiet: true, path: envPath });

describe(`project middlerware tests`, async () => {
  before(async () => await initTestDatabase());
  after(() => concludeTesting());

  test(`checkProjectHealth`, () => {
    // TODO: this one is too much work right now
  });

  test(`createProjectDownload`, () => {
    // TODO: this one is too much work right now
  });

  test(`deleteProject`, () => {
    // TODO: this one is too much work right now
  });

  test(`loadProject`, () => {
    // TODO: this one is too much work right now
  });

  test(`loadProjectHistory`, () => {
    // TODO: this one is too much work right now
  });

  test(`remixProject`, () => {
    // TODO: this one is too much work right now
  });

  test(`restartProject`, () => {
    // TODO: this one is too much work right now
  });

  test(`startProject`, () => {
    // TODO: this one is too much work right now
  });

  test(`updateProjectSettings`, () => {
    // TODO: this one is too much work right now
  });
});
