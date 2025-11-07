import { checkDependencies } from "./src/setup/dependencies.js";

const bypass = !!process.env.BYPASS_DEPENDENCIES;
if (bypass) process.exit(0);

try {
  checkDependencies();
} catch (e) {
  console.error(e.message, `\n`);
  process.exit(1);
}

console.log(`All dependencies have been met.`);
process.exit(0);
