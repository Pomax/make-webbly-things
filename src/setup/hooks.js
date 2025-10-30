/* node:coverage disable */
import { cpSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SETUP_ROOT_DIR } from "./utils.js";

const hooksDir = join(SETUP_ROOT_DIR, `.git`, `hooks`);
const preCommitFile = join(hooksDir, `pre-commit`);
const preCommitContent = `#!/bin/sh\nnpm run lint\n`;

/**
 * We need a precommit hook set up for git
 */
export function setupHooks() {
  if (existsSync(preCommitFile)) return;

  console.log(`Setting up git hooks...`);

  // We first copy over the sample file, because that has the executable bit set
  cpSync(`${preCommitFile}.sample`, preCommitFile, { force: true });

  // And then we update the content. If we don't, we get a pre-commit hook
  // that can't actually run, which isn't super useful.
  writeFileSync(preCommitFile, preCommitContent);
}
