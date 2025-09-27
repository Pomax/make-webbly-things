import test, { describe } from "node:test";
import assert from "node:assert/strict";
import * as GitUtils from "../../../server/git/git-utils.js";
import { execSync } from "node:child_process";
import { applyPatch } from "../../../../public/vendor/diff.js";

describe(`Git utils tests`, async () => {
  test(`getFileHistory`, () => {
    const diffs = GitUtils.getFileHistory(`.`, `README.md`);
    assert.equal(diffs.length, 13);

    // verify all rollbacks and fast forwards are correct
    const getFileFrom = (hash) =>
      execSync(`git show ${hash}:README.md`).toString();
    diffs.forEach((diff) => (diff.file = getFileFrom(diff.hash)));

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
