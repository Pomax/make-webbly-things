/* node:coverage disable */
import { cpSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SETUP_ROOT_DIR } from "./utils.js";

const hookContent = `#!/bin/sh\nnpm run lint\n`;
const hooksDir = join(SETUP_ROOT_DIR, `.git`, `hooks`);

/**
 * We need a precommit hook set up for git
 */
export function setupHooks() {
  console.log(`Setting up git hooks...`);
  cpSync(join(hooksDir, `pre-commit.sample`), join(hooksDir, `pre-commit`));
  writeFileSync(join(hooksDir, `pre-commit`), hookContent);
}
