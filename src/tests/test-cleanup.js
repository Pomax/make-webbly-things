// Get all docker-project-... containers, stop them,
// and delete their images. No
import { execSync } from "node:child_process";
import {
  getAllRunningContainers,
  deleteContainerAndImage,
} from "../server/docker/docker-helpers.js";

// First, clean up orphaned folders
execSync(`rm -rf ./content/docker-*`);

// Then clean up any test containers
getAllRunningContainers()
  .filter((e) => e.image.startsWith(`docker-project-`))
  .forEach((e) => {
    console.log(e.image);
    deleteContainerAndImage({ slug: e.image });
  });

// And then do an "orphaned images" pass:
execSync(`docker image list -a --no-trunc --format json`)
  .toString()
  .split(`\n`)
  .filter(Boolean)
  .map((e) => JSON.parse(e))
  .forEach((e) => {
    if (e.Repository.startsWith(`docker-project-`)) {
      execSync(`docker image rm ${e.ID}`);
    }
  });
