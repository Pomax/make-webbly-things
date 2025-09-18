import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve, join, dirname } from "node:path";
import {
  initTestDatabase,
  concludeTesting,
} from "../../../../../server/database/index.js";
import * as Middleware from "../../../../../server/routing/v1/files/middleware.js";
import * as ProjectMiddleware from "../../../../../server/routing/v1/projects/middleware.js";
import { createDockerProject } from "../../../../test-helpers.js";
import { createPatch } from "../../../../../../public/vendor/diff.js";

import dotenv from "@dotenvx/dotenvx";
import { ROOT_DIR, CONTENT_DIR } from "../../../../../helpers.js";
const envPath = resolve(join(ROOT_DIR, `.env`));
dotenv.config({ quiet: true, path: envPath });

const WITHOUT_RUNNING = false;
const FORCE_CLEANUP = true;

/**
 * A common test wrapper that ensures there's a project
 * whose files we can mess with.
 */
async function runTestWithDockerProject(testFunction) {
  const req = { params: {}, query: {}, body: {} };
  const { res, cleanup } = await createDockerProject(WITHOUT_RUNNING);
  await new Promise((resolve) => {
    ProjectMiddleware.loadProject(req, res, (err) => {
      assert.equal(!!err, false);
      testFunction(req, res, resolve);
    });
  });
  await cleanup(FORCE_CLEANUP);
}

describe(`project middlerware tests`, async () => {
  before(async () => {
    await initTestDatabase();
  });

  after(() => {
    concludeTesting();
  });

  // doubles as createFile test
  test(`deleteFile`, async () => {
    await runTestWithDockerProject((req, res, next) => {
      const { slug } = res.locals.lookups.project;
      const fileName = `testing/cake/layers.txt`;
      res.locals.fullPath = join(ROOT_DIR, CONTENT_DIR, slug, fileName);
      Middleware.createFile(req, res, async (err) => {
        assert.equal(!!err, false);
        const fullPath = join(ROOT_DIR, CONTENT_DIR, slug, fileName);
        assert.equal(existsSync(fullPath), true);
        Middleware.deleteFile(null, res, async (err) => {
          assert.equal(!!err, false);
          assert.equal(existsSync(fullPath), false);
          next();
        });
      });
    });
  });

  test(`formatFile`, async () => {
    await runTestWithDockerProject((req, res, next) => {
      const { slug } = res.locals.lookups.project;
      const fileName = `testing/cake/layers.js`;
      const fullPath = join(ROOT_DIR, CONTENT_DIR, slug, fileName);
      res.locals.fullPath = fullPath;
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, `let a      = 1  +\n2`);
      Middleware.formatFile(req, res, async (err) => {
        assert.equal(!!err, false);
        assert.equal(res.locals.formatted, true);
        const content = readFileSync(fullPath).toString(`utf-8`);
        assert.equal(content, `let a = 1 + 2;\n`);
        next();
      });
    });
  });

  test(`getDirListing`, async () => {
    await runTestWithDockerProject((req, res, next) => {
      const { slug } = res.locals.lookups.project;
      const base = join(ROOT_DIR, CONTENT_DIR, slug);
      mkdirSync(dirname(base), { recursive: true });
      const files = [1, 2, 3, 4, 5].map((i) => {
        const name = join(base, `file${i}.txt`);
        writeFileSync(name, `this is some text (${i})`);
        return basename(name);
      });
      Middleware.getDirListing(req, res, async (err) => {
        assert.equal(!!err, false);
        assert.deepEqual(res.locals.dirData.files.sort(), files);
        next();
      });
    });
  });

  test.skip(`getMimeType`, async () => {
    // TODO: there are far too many mime types to check on a first pass  =)
  });

  test(`handleUpload`, async () => {
    // TODO: this is purely a codepath test right now, and
    //       needs WAY more tests to make sure all the various
    //       uploads *fail* when they're supposed to fail.
    await runTestWithDockerProject((req, res, next) => {
      const { slug } = res.locals.lookups.project;
      const fileName = `testing/cake/layers.js`;
      res.locals.fullPath = join(ROOT_DIR, CONTENT_DIR, slug, fileName);
      const base = join(ROOT_DIR, CONTENT_DIR, slug);
      const fullPath = join(base, fileName);
      res.locals.fileName = fileName;
      req.body.content = {
        value: `"use strict"\nconst a = 3;\n// what a test\n`,
      };
      Middleware.handleUpload(req, res, async (err) => {
        assert.equal(!!err, false);
        assert.equal(existsSync(fullPath), true);
        next();
      });
    });
  });

  test(`patchFile`, async () => {
    await runTestWithDockerProject((req, res, next) => {
      const { project } = res.locals.lookups;
      const { slug } = project;
      const fileName = `testing/cake/layers.js`;
      const fullPath = (res.locals.fullPath = join(
        ROOT_DIR,
        CONTENT_DIR,
        slug,
        fileName,
      ));
      const content = `let a = 1 + 2;\n`;
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, content);

      const update = `let b = 2 + 3;\n`;
      const patch = createPatch(fileName, content, update);
      req.body = patch;

      Middleware.patchFile(req, res, async (err) => {
        assert.equal(!!err, false);
        const content = readFileSync(fullPath).toString(`utf-8`);
        assert.equal(content, update);
        next();
      });
    });
  });

  test(`moveFile`, async () => {
    await runTestWithDockerProject((req, res, next) => {
      const { slug } = res.locals.lookups.project;
      const fileName = `cake.js`;
      const fullPath = (res.locals.fullPath = join(
        ROOT_DIR,
        CONTENT_DIR,
        slug,
        fileName,
      ));
      const content = `let a = 1 + 2;\n`;
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, content);

      req.params = {
        0: ``,
        project: `curvetest`,
        slug: `cake.js:newcake.js`,
      };

      Middleware.moveFile(req, res, async (err) => {
        assert.equal(!!err, false);
        assert.equal(existsSync(fullPath), false);
        const newCake = fullPath.replace(`cake.js`, `newcake.js`);
        assert.equal(existsSync(newCake), true);
        next();
      });
    });
  });
});
