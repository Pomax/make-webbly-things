import test, { describe } from "node:test";
import assert from "node:assert";
import * as Utils from "../../setup/utils.js";

Utils.checkNodeVersion();
Utils.runNpmInstall();

describe(`Setup script tests`, async () => {
  test(`There are no parse errors`, async () => {
    await import("../../setup/index.js")
      .then((lib) => {
        const { runSetup } = lib;
        assert.equal(!!runSetup, true);
      })
      .catch((e) => {
        console.error(e);
        assert.equal(e, false);
      });
    // make sure we don't have a dangling stdin!
    Utils.closeReader();
  });
});

// TODO: how on earth do we test the rest??
