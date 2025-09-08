import { resolve, join } from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

import * as User from "../server/database/user.js";
import * as Project from "../server/database/project.js";

import dotenv from "@dotenvx/dotenvx";
import { CONTENT_DIR, scrubDateTime } from "../helpers.js";
const envPath = resolve(join(import.meta.dirname, `..`, `..`, `.env`));
dotenv.config({ quiet: true, path: envPath });

/**
 * obviously
 */
export function randomDockerProjectName() {
  return `docker-project-${randomUUID().substring(0, 8)}`;
}

/**
 * Create a docker project and run it, so that tests
 * can perform docker related activities.
 *
 * Also used in the project middleware tests
 */
export async function createDockerProject(run = true, gracePeriod = 500) {
  // create a docker project...
  const user = User.getUser(`test-user`);
  const slug = randomDockerProjectName();
  const project = Project.createProjectForUser(user, slug);
  project.updated_at = scrubDateTime(new Date(0).toISOString());

  Project.updateSettingsForProject(project, {
    app_type: `docker`,
    run_script: `npx http-server`,
  });

  // And create the associated user content...
  const projectDir = join(CONTENT_DIR, slug);
  const projectContainerDir = join(projectDir, `.container`);
  try {
    mkdirSync(projectDir);
    mkdirSync(projectContainerDir);
  } catch (e) {}

  writeFileSync(
    join(projectContainerDir, `run.sh`),
    project.settings.run_script,
  );

  // Let docker start up the project...
  if (run) await Project.runProject(project);

  // Construct a middleware "response" mock...
  const res = {
    locals: {
      user,
      projectDir,
      projectContainerDir,
      lookups: { project },
    },
  };

  // And a cleanup function...
  const cleanup = async (forceStop = false) => {
    if (run || forceStop) await Project.stopProject(project);
    rmSync(join(CONTENT_DIR, slug), {
      recursive: true,
      force: true,
    });
  };

  // And then resolve after a grace period (if we started a container)
  return await new Promise((resolve) =>
    setTimeout(() => resolve({ res, cleanup }), run ? gracePeriod : 1),
  );
}
