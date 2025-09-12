/**
 * The "browser based web editor" setup script. This script:
 *
 * - will run npm install to make sure the code can run,
 * - checks whether or not you have docker, caddy, and sqlite3 installed
 * - If you don't, it'll do nothing and tell you to install them.
 * - If you do, it will:
 *   - set up the docker base image that is used for projects,
 *   - set up a Caddyfile for this project that gets used for host routing, and
 *   - set up the database that the code relies on for housing user/project/etc data.
 *   - set up an .env file that holds all the various environment variables needed
 */

import { join } from "node:path";
import { writeFileSync } from "node:fs";
import { pathExists } from "../helpers.js";
import dotenv from "@dotenvx/dotenvx";
dotenv.config({ quiet: true });

import { checkNodeVersion, runNpmInstall, SETUP_ROOT_DIR } from "./utils.js";
import { checkDependencies } from "./dependencies.js";
import { setupEnv } from "./env.js";
import { setupCaddy } from "../server/caddy/caddy.js";
import { setupDocker } from "./docker.js";
import { setupSqlite } from "./sqlite.js";

const dbPath = join(SETUP_ROOT_DIR, `data`, `data.sqlite3`);
const BYPASS_FINISH = pathExists(dbPath);
const DOCKER_MAINTENANCE = process.argv.includes(`--clean`);
const noop = () => {};

/**
 * This is an export so that we can either run it, or
 * import it in a test to at least get "free" parse checking.
 */
export function runSetup() {
  setup(
    checkNodeVersion,
    runNpmInstall,
    checkDependencies,
    setupEnv,
    setupDocker,
    DOCKER_MAINTENANCE ? noop : () => setupCaddy(process.env),
    DOCKER_MAINTENANCE ? noop : setupSqlite,
  );
}

/**
 * This is a utility function that just runs through a series of functions
 * and if none of them throw, setup was a success. If even a single one
 * throws, then setup is halted and you get informed about that failure.
 */
async function setup(...handlers) {
  try {
    while (handlers.length) {
      await handlers.shift()();
    }

    // If we run setup after we already have a database set up,
    // folks probably don't want the first-time-setup,
    // first-login-becomes-admin functionality, so don't
    // create the file that triggers that:
    if (BYPASS_FINISH) {
      console.log(`
Setup complete.

Run "npm start", log in, and have fun!
`);
    }

    // If there was no database yet, though, make sure that when
    // the user first logs into the system, their login immediately
    // enables the user account, and flips the admin switch for it.
    else {
      const token = `${Math.random()}`.substring(2);
      writeFileSync(join(SETUP_ROOT_DIR, `.finish-setup`), token);

      console.log(`
Setup complete.

Run "npm start", and log in using GitHub. This will create
the initial (enabled and admin) user account with which to
do everything else.
`);
    }

    process.exit(0);
  } catch (e) {
    const stack = e.stack.split(`\n`);
    console.log(`\n  `, stack[0].trim());
    console.log(`\nSetup incomplete. Please review the errors.\n`);
    process.exit(1);
  }
}
