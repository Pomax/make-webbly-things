import test, { after, before, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { OTHandler } from "../../../../../server/routing/v1/websocket/ot-handler.js";
import {
  initTestDatabase,
  concludeTesting,
  clearTestData,
} from "../../../../../server/database/index.js";
import { closeReader } from "../../../../../setup/utils.js";
import { createProject, createUser } from "../../../../test-helpers.js";

describe(`comm tests`, async () => {
  before(async () => await initTestDatabase());
  beforeEach(() => clearTestData());
  after(() => {
    concludeTesting();
    closeReader();
  });

  test(`Handler setup`, async () => {
    const user = createUser();
    createProject(`test-project`, user);
    const handler = new OTHandler(
      {
        send: () => {},
        close: () => {},
      },
      user,
    );
    await handler.onload({ basePath: `test-project` });
    assert.equal(handler.basePath, `test-project`);
    const path = handler.getFullPath(`cake`);
    assert.equal(path, join(`content`, `test-project`, `cake`));
    // We can probably do some OT here, but
    // that'll be for another day.
    handler.send(`doesn't`, `matter`);
  });
});
