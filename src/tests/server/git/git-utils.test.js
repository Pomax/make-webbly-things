import test, { describe } from "node:test";
import assert from "node:assert/strict";
import * as GitUtils from "../../../server/git/git-utils.js";

const forward = `--- a/README.md
+++ b/README.md
@@ -1,5 +1,7 @@
 # Make Webbly Things!
 
+Like over on https://make.webblythings.com! (just remember to read that wall of text, because unless we're friends, I'm unlikely to activate your account on my personal instance =)
+
 ## Use the web to build the web
 
 <img width="100%" style="border: 1px solid black" src="public/screenshot.png">
`;

const reverse = `--- a/README.md
+++ b/README.md
@@ -1,7 +1,5 @@
 # Make Webbly Things!
 
-Like over on https://make.webblythings.com! (just remember to read that wall of text, because unless we're friends, I'm unlikely to activate your account on my personal instance =)
-
 ## Use the web to build the web
 
 <img width="100%" style="border: 1px solid black" src="public/screenshot.png">
`;

describe(`Git utils tests`, async () => {
  test(`getFileHistory`, () => {
    const diffs = GitUtils.getFileHistory(`.`, `README.md`);
    assert.equal(diffs.length, 13);
    assert.deepEqual(diffs.at(-2), {
      timestamp: 1756403570000,
      forward,
      reverse,
    });
  });
});
