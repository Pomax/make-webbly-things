import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { getFileFrom, getFileHistory } from "../../../server/git/git-utils.js";
import { applyPatch } from "../../../../public/vendor/diff.js";

describe(`Git utils tests`, async () => {
  // verify all rollbacks and fast forwards are correct
  test(`getFileHistory`, () => {
    const filepath = `README.md`;
    const diffs = getFileHistory(`.`, filepath);
    diffs.forEach((diff) => (diff.file = getFileFrom(diff.hash, filepath)));

    // verify rollback
    for (let i = 0; i < diffs.length - 1; i++) {
      const [d1, d2] = diffs.slice(i);
      const original = d1.file;
      const patched = applyPatch(original, d1.reverse);
      assert.equal(d2.file, patched);
    }

    // verify fast-forward
    diffs.reverse();
    for (let i = 0; i < diffs.length - 1; i++) {
      const [d1, d2] = diffs.slice(i);
      const original = d1.file;
      const patched = applyPatch(original, d2.forward);
      assert.equal(d2.file, patched);
    }
  });
});
