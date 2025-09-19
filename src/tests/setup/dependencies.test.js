import test, { after, describe } from "node:test";
import assert from "node:assert";
import { checkDependencies } from "../../setup/dependencies.js";
import { closeReader } from "../../setup/utils.js";

describe(`Setup dependency test`, async () => {
  after(() => closeReader());

  test(`checkDependencies`, () => {
    try {
      const result = checkDependencies();
      assert.equal(result, undefined);
    } catch (e) {
      assert.fail(`checkDependencies threw, and it really shouldn't have`);
    }
  });
});
