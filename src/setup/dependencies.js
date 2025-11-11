import { execSync } from "node:child_process";
import { checkFor, STDIO } from "./utils.js";
import { BYPASS_CADDY, BYPASS_DOCKER } from "../helpers.js";

/**
 * Verify we have all the tools necessary to run the codebase.
 */
export function checkDependencies() {
  const missing = [];
  checkForGit(missing);
  BYPASS_CADDY && checkForCaddy(missing);
  checkForSqlite(missing);
  const dockerRunning = BYPASS_DOCKER ? true : checkForDocker(missing); // has to be last
  if (missing.length) {
    throw new Error(`Missing dependencies: ${missing.join(`, `)}`);
  }
  if (!dockerRunning) {
    throw new Error(
      `The docker command is available, but docker engine is not currently running.`,
    );
  }
}

/**
 * Is caddy installed?
 */
function checkForCaddy(missing) {
  return checkFor(`caddy`, missing);
}

/**
 * Check if the docker command works, and if it does, whether or not
 * docker engine is running, because the docker CLI can't work without
 * that running in the background.
 */
function checkForDocker(missing) {
  checkFor(`docker`, missing);
  try {
    execSync(`docker ps`, { shell: true, stdio: STDIO });
    return true;
  } catch (e) {}
}

/**
 * Make sure we have git installed.
 */
function checkForGit(missing) {
  checkFor(`git`, missing);
}

/**
 * Is sqlite3 installed?
 */
function checkForSqlite(missing) {
  return checkFor(`sqlite3`, missing);
}
