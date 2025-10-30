import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as Utils from "./src/setup/utils.js";

// Parse the .env file
const envFile = join(Utils.SETUP_ROOT_DIR, `.env`);
if (existsSync(envFile)) {
  const data = readFileSync(envFile).toString();
  const entries = Object.fromEntries(
    data
      .split(`\n`)
      .filter(Boolean)
      .map((e) => e.split(`=`).map((v) => v.trim().replaceAll(`"`, ``)))
  );
  const keys = Object.keys(entries);
  for (const k of keys) {
    process.env[k] = entries[k];
  }
}

// Are we on the right version of Node?
Utils.checkNodeVersion();

// If we are, make sure the dependencies are installed
Utils.runNpmInstall;

// And then run the setup script.
import("./src/setup/index.js").then(({ runSetup }) => runSetup());
