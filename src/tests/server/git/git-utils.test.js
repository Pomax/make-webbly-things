import test, { describe } from "node:test";
import assert from "node:assert/strict";
import * as GitUtils from "../../../server/git/git-utils.js";

const forward = `--- a/README.md
+++ b/README.md
@@ -157,6 +157,10 @@ And as an admin you can:
   - see a list of and stop running, or delete expired containers
 - Load up suspended projects in the editor (without running the project container)
 
+## What if I want to deploy my own instance?
+
+Give [the deployment doc](./docs/deploying.md) a read-through. There's a bit more information than in this README.md, but all of it will be important to have gone through if you want to set up your own instance.
+
 ## I want more <sup>and</sup>⧸<sub>or</sub> I have ideas
 
 I know. [Get in touch](https://github.com/Pomax/make-webbly-things/issues). We can do more.
`;

const reverse = `--- a/README.md
+++ b/README.md
@@ -157,10 +157,6 @@ And as an admin you can:
   - see a list of and stop running, or delete expired containers
 - Load up suspended projects in the editor (without running the project container)
 
-## What if I want to deploy my own instance?
-
-Give [the deployment doc](./docs/deploying.md) a read-through. There's a bit more information than in this README.md, but all of it will be important to have gone through if you want to set up your own instance.
-
 ## I want more <sup>and</sup>⧸<sub>or</sub> I have ideas
 
 I know. [Get in touch](https://github.com/Pomax/make-webbly-things/issues). We can do more.
`;

describe(`Git utils tests`, async () => {
  test(`getFileHistory`, () => {
    const diffs = GitUtils.getFileHistory(`.`, `README.md`);
    assert.equal(diffs.length, 12);
    assert.deepEqual(diffs.at(-2), {
      timestamp: 1756403713000,
      forward,
      reverse,
    });
  });
});
