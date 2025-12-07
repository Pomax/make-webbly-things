import { execSync } from "node:child_process";
import { checkFor, STDIO } from "./utils.js";
import { BYPASS_CADDY, BYPASS_DOCKER } from "../helpers.js";
import { parseEnvironment } from "../parse-environment.js";

/**
 * Verify we have all the tools necessary to run the codebase.
 */
export function checkDependencies() {
  parseEnvironment();
  const { DOCKER_EXECUTABLE: DOCKER } = process.env;
  const missing = [];
  checkForGit(missing);
  BYPASS_CADDY && checkForCaddy(missing);
  checkForSqlite(missing);
  try {
    BYPASS_DOCKER ? true : checkForDocker(missing);
    if (missing.length) {
      throw new Error(`Missing dependencies: ${missing.join(`, `)}`);
    }
  } catch (e) {
    throw new Error(
      `The ${DOCKER} command is available, but "${DOCKER} ps" threw an error:\n${e.message}`,
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
  const { DOCKER_EXECUTABLE: DOCKER } = process.env;

  checkFor(DOCKER, missing);
  execSync(`${DOCKER} ps`, { shell: true, stdio: STDIO });
  return true;
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
