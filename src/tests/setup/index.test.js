import test, { after, before, describe } from "node:test";
import assert from "node:assert";
import * as Utils from "../../setup/utils.js";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ROOT_DIR } from "../../helpers.js";

const setupTestDir = join(ROOT_DIR, `__setup_target_dir/`);

Utils.checkNodeVersion();
Utils.runNpmInstall();

describe(`Setup script tests`, async () => {
  before(() => {
    mkdirSync(setupTestDir);
  });

  after(() => {
    rmSync(setupTestDir, { recursive: true, force: true });
    Utils.closeReader();
  });

  test(`There are no parse errors on load`, async () => {
    await import("../../setup/index.js")
      .then((lib) => {
        const { runSetup } = lib;
        assert.equal(!!runSetup, true);
      })
      .catch((e) => {
        console.error(e);
        assert.equal(e, false);
      });
  });
});

// TODO: how on earth do we test the rest??
