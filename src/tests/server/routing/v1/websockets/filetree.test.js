import test, { after, before, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import {
  initTestDatabase,
  concludeTesting,
  clearTestData,
} from "../../../../../server/database/index.js";
import {
  setupFileTreeWebSocket,
  addFileTreeCommunication,
} from "../../../../../server/routing/v1/websocket/for-file-tree.js";
import { closeReader } from "../../../../../setup/utils.js";
import { createProject } from "../../../../test-helpers.js";

describe(`filetree tests`, async () => {
  before(async () => await initTestDatabase());
  beforeEach(() => clearTestData());
  after(() => {
    concludeTesting();
    closeReader();
  });

  test(`setupFileTreeWebSocket`, async () => {
    createProject(`test-project`);
    // We just want to make sure there are no parse errors
    setupFileTreeWebSocket({}, {});
    await addFileTreeCommunication(
      {
        on: async (_, fn) => {
          await fn(
            JSON.stringify({
              type: `file-tree:load`,
              detail: {
                basePath: `test-project`,
              },
            }),
          );
          assert.equal(true, true);
        },
        close: () => {},
      },
      {
        session: {
          passport: {
            user: true,
          },
        },
      },
    );
  });
});
