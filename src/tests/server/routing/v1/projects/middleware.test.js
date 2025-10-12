import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import {
  initTestDatabase,
  concludeTesting,
} from "../../../../../server/database/index.js";
import * as Middleware from "../../../../../server/routing/v1/projects/middleware.js";
import * as FileMiddleware from "../../../../../server/routing/v1/files/middleware.js";
import {
  createDockerProject,
  randomDockerProjectName,
} from "../../../../test-helpers.js";
import { closeReader } from "../../../../../setup/utils.js";
import { portBindings } from "../../../../../server/caddy/caddy.js";
import { CONTENT_DIR, ROOT_DIR } from "../../../../../helpers.js";

import dotenv from "@dotenvx/dotenvx";
const envPath = resolve(join(ROOT_DIR, `.env`));
dotenv.config({ quiet: true, path: envPath });

const WITHOUT_RUNNING = false;
const FORCE_CLEANUP = true;

describe(`project middlerware tests`, async () => {
  before(async () => await initTestDatabase());
  after(() => {
    concludeTesting();
    closeReader();
  });

  test(`checkProjectHealth`, async () => {
    const { res, cleanup } = await createDockerProject();
    await new Promise((resolve) => {
      Middleware.checkProjectHealth(null, res, async (err) => {
        await cleanup();
        assert.equal(!!err, false);
        const { healthStatus } = res.locals;
        // we're okay with either "wait" or "running"
        assert.notEqual(healthStatus, `failed`);
        assert.notEqual(healthStatus, `not running`);
        resolve();
      });
    });
  });

  test(`createProjectDownload`, async () => {
    const { res, cleanup } = await createDockerProject(WITHOUT_RUNNING);
    await new Promise((resolve) => {
      FileMiddleware.getDirListing(null, res, () => {
        Middleware.createProjectDownload(null, res, async (err) => {
          await cleanup();
          assert.equal(!!err, false);
          const { zipFile } = res.locals;
          assert.equal(existsSync(zipFile), true);
          rmSync(zipFile);
          resolve();
        });
      });
    });
  });

  test(`deleteProject`, async () => {
    const { res } = await createDockerProject();
    await new Promise((resolve) => {
      Middleware.deleteProject(null, res, async (err) => {
        // This should have stopped the container and cleaned up
        // the dir already, so we should not need to run cleanup()
        assert.equal(!!err, false);
        const { lookups, projectDir } = res.locals;
        assert.equal(existsSync(projectDir), false);
        const { slug } = lookups.project;
        assert.equal(portBindings[slug], undefined);
        resolve();
      });
    });
  });

  test(`getProjectSettings`, async () => {
    const { res, cleanup } = await createDockerProject(WITHOUT_RUNNING);
    const { project } = res.locals.lookups;
    await new Promise((resolve) => {
      Middleware.getProjectSettings(null, res, async (err) => {
        await cleanup();
        assert.equal(!!err, false);
        const { settings } = res.locals;
        const test = { ...project, ...project.settings };
        assert.deepEqual(settings, test);
        resolve();
      });
    });
  });

  test(`loadProject`, async () => {
    // TODO: there are a lot of separate code paths to test here
    const { res, cleanup } = await createDockerProject(WITHOUT_RUNNING);
    const { slug, settings } = res.locals.lookups.project;
    await new Promise((resolve) => {
      Middleware.loadProject({}, res, async (err) => {
        assert.equal(!!err, false);
        assert.deepEqual(settings, res.locals.projectSettings);
        // confirm we have a .git dir before cleanup
        const gitDir = join(CONTENT_DIR, slug, `.git`);
        assert.equal(existsSync(gitDir), true);
        // Clean up with a force-stop, because loadProject
        // will have started a container for this project!
        await cleanup(FORCE_CLEANUP);
        resolve();
      });
    });
  });

  test(`loadProjectHistory`, async () => {
    // TODO: this one requires creating a project, and then
    //       triggering a bunch of changes and rewind points,
    //       so we can then compare the git log to those changes.
  });

  test(`remixProject`, async () => {
    // TODO: we should add tests for .data and env_var copies
    const { res, cleanup } = await createDockerProject(WITHOUT_RUNNING);
    const req = {
      params: {
        newname: randomDockerProjectName(),
      },
    };
    await new Promise((resolve) => {
      Middleware.remixProject(req, res, async (err) => {
        assert.equal(!!err, false);
        // confirm the file system content exists
        const { newProject } = res.locals;
        const containerDir = join(CONTENT_DIR, newProject.slug, `.container`);
        assert.equal(existsSync(containerDir), true);
        const runScript = join(containerDir, `run.sh`);
        assert.equal(existsSync(runScript), true);
        // Then clean up the original project
        await cleanup(FORCE_CLEANUP);
        // And then clean up the remix
        res.locals.lookups.project = res.locals.newProject;
        Middleware.deleteProject(req, res, () => resolve());
      });
    });
  });

  test(`restartProject`, async () => {
    const { res, cleanup } = await createDockerProject();
    const { slug } = res.locals.lookups.project;
    const { port } = portBindings[slug];
    await new Promise((resolve) => {
      Middleware.restartProject(null, res, async (err) => {
        assert.equal(!!err, false);
        const { port: newPort, restarts } = portBindings[slug];
        assert.equal(port, newPort);
        assert.equal(restarts, 1);
        await cleanup();
        resolve();
      });
    });
  });

  test(`startProject`, async () => {
    const { res, cleanup } = await createDockerProject(WITHOUT_RUNNING);
    const { WEB_EDITOR_APP_SECRET } = process.env;
    const req = {
      params: {
        secret: WEB_EDITOR_APP_SECRET,
      },
    };
    await new Promise((resolve) => {
      Middleware.startProject(req, res, async (err) => {
        assert.equal(!!err, false);
        await cleanup(FORCE_CLEANUP);
        resolve();
      });
    });
  });

  test(`updateProjectSettings`, async () => {
    const { res, cleanup } = await createDockerProject(WITHOUT_RUNNING);
    const req = {
      body: {
        env_vars: `WELL=loveley`,
      },
    };
    await new Promise((resolve) => {
      Middleware.updateProjectSettings(req, res, async (err) => {
        if (err) console.log(err);
        assert.equal(!!err, false);
        // TODO: We'll need tests for all the possible setting update paths...
        //       so for now we simply touch the code path without testing it.
        await cleanup(FORCE_CLEANUP);
        resolve();
      });
    });
  });
});
