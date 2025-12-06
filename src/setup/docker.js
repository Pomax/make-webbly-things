/* node:coverage disable */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { SETUP_ROOT_DIR, STDIO } from "./utils.js";

const DOCKER_MAINTENANCE = process.argv.includes(`--clean`);

/**
 * If we have docker available, check to see if the base image that
 * the codebase needs already exists, and if not, build it.
 */
export function setupDocker() {
  const { DOCKER_EXECUTABLE, WEB_EDITOR_IMAGE_NAME } = process.env;

  if (DOCKER_MAINTENANCE) {
    console.log(`\n- Cleaning up docker images...`);

    // clean up anything unrelated to currently running containers
    execSync(`${DOCKER_EXECUTABLE} system prune -a -f`, {
      shell: true,
      stdio: STDIO,
    });

    console.log(`- Generating an updated ${WEB_EDITOR_IMAGE_NAME}...`);

    // generate a new version of the base image
    execSync(`${DOCKER_EXECUTABLE} build -t ${WEB_EDITOR_IMAGE_NAME} .`, {
      shell: true,
      cwd: `./src/server/docker`,
      stdio: STDIO,
    });

    console.log(`Done.`);

    return;
  }

  try {
    execSync(`${DOCKER_EXECUTABLE} image inspect ${WEB_EDITOR_IMAGE_NAME}`, {
      shell: true,
      stdio: STDIO,
    });
  } catch (e) {
    execSync(`${DOCKER_EXECUTABLE} build -t ${WEB_EDITOR_IMAGE_NAME} .`, {
      shell: true,
      cwd: `./src/server/docker`,
      stdio: STDIO,
    });
  }
  writeFileSync(
    join(SETUP_ROOT_DIR, `Dockerfile`),
    `FROM ${WEB_EDITOR_IMAGE_NAME}:latest
CMD sh .container/run.sh
`,
  );
}
