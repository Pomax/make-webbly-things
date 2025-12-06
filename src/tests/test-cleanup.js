// Get all test-suite-docker-project-... containers, stop them,
// and delete their images. No
import { execSync } from "node:child_process";
import {
  getAllRunningContainers,
  deleteContainerAndImage,
  parseDockerJSON,
} from "../server/docker/docker-helpers.js";
import { DOCKER } from "../helpers.js";

const prefix = `test-suite-docker-project`;
console.log(`\nRunning test cleanup...\n`);

// First, clean up orphaned folders
execSync(`rm -rf ./content/${prefix}-*`);

// And screenshots
execSync(`rm -rf ./content/__screenshots/${prefix}`);

// And test data
execSync(`rm -rf ./data/*.data.sql`);
execSync(`rm -rf ./data/*.test.sqlite3`);
execSync(`rm -rf ./data/*.sqlite3-journal`);

// Then clean up any test containers
getAllRunningContainers()
  .filter((e) => e.image.startsWith(prefix))
  .forEach((e) => {
    console.log(`getAllRunningContainers - deleting ${e.image}`);
    deleteContainerAndImage({ slug: e.image });
  });

// And then do an "orphaned images" pass:
parseDockerJSON(
  execSync(`${DOCKER} image list -a --no-trunc --format json`).toString(),
).forEach((e) => {
  const { id, repository, names } = e;
  let remove = false;
  // FIXME: This is a temporary piece of cleanup code for as long as
  //        podman doesn't list `repository` in its JSON output.
  //        See https://github.com/containers/podman/issues/27632
  if (repository) {
    remove = repository.startsWith(prefix);
  } else if (names) {
    remove = names[0].includes(`/${prefix}`);
  }

  if (remove) {
    try {
      execSync(`${DOCKER} image rm ${id} -f`, { stdio: `ignore` });
    } catch {
      /* we don't care */
    }
  }
});

console.log(`Test cleanup complete.\n\n`);
