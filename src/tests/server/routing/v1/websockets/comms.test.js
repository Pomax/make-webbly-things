// DONE
import test, { after, before, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { comms } from "../../../../../server/routing/v1/websocket/comms.js";
import {
  initTestDatabase,
  concludeTesting,
  clearTestData,
} from "../../../../../server/database/index.js";
import { closeReader } from "../../../../../setup/utils.js";
import { createProject } from "../../../../test-helpers.js";

describe(`comm tests`, async () => {
  before(async () => await initTestDatabase());
  beforeEach(() => clearTestData());
  after(() => {
    concludeTesting();
    closeReader();
  });

  test(`Handler setup`, async () => {
    createProject(`test-project`);
    const fish = `macherel`;
    const backup = `tuna`;
    const handler = {
      id: 1,
      basePath: `test-project`,
      send: (type, detail) => {
        assert.equal(type, `cake`);
        assert.deepEqual(detail, {
          fish,
          backup,
          from: 1,
          seqnum: 1,
          when: detail.when,
        });
      },
    };
    comms.addHandler(handler);
    comms.addAction(handler, { action: `cake`, fish, backup });
  });
});
