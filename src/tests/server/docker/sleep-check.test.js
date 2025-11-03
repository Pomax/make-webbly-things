import test, { after, before, beforeEach, describe } from "node:test";
import { scheduleContainerCheck } from "../../../server/docker/sleep-check.js";
import { createDockerProject } from "../../test-helpers.js";
import { closeReader } from "../../../setup/utils.js";
import {
  initTestDatabase,
  concludeTesting,
  clearTestData,
} from "../../../server/database/index.js";

describe(`sleep check tests`, async () => {
  before(async () => await initTestDatabase());
  beforeEach(() => clearTestData());
  after(() => {
    concludeTesting();
    closeReader();
  });

  test(`codepath has no runtime errors`, async () => {
    const projects = await Promise.all([
      createDockerProject(),
      createDockerProject(),
      createDockerProject(),
    ]);

    // Tun, and then we can immediately stop again.
    // We just want to make sure the codepath has
    // no runtime errors here...
    (await scheduleContainerCheck())();

    await Promise.all(projects.map((p) => p.cleanup()));
  });
});
