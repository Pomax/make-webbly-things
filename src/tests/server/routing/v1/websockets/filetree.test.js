import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import {
  initTestDatabase,
  concludeTesting,
} from "../../../../../server/database/index.js";
import {
  setupFileTreeWebSocket,
  addFileTreeCommunication,
} from "../../../../../server/routing/v1/websocket/for-file-tree.js";
import { closeReader } from "../../../../../setup/utils.js";

describe(`filetree tests`, async () => {
  before(async () => await initTestDatabase());

  after(() => {
    concludeTesting();
    closeReader();
  });

  test(`setupFileTreeWebSocket`, async () => {
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
