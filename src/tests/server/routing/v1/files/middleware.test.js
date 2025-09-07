import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import {
  initTestDatabase,
  concludeTesting,
} from "../../../../../server/database/index.js";
import * as Middleware from "../../../../../server/routing/v1/files/middleware.js";
import * as ProjectMiddleware from "../../../../../server/routing/v1/projects/middleware.js";

import { createDockerProject } from "../../../../test-helpers.js";

import dotenv from "@dotenvx/dotenvx";
import { ROOT_DIR, CONTENT_DIR } from "../../../../../helpers.js";
const envPath = resolve(
  join(import.meta.dirname, `..`, `..`, `..`, `..`, `..`, `..`, `.env`),
);
dotenv.config({ quiet: true, path: envPath });

const WITHOUT_RUNNING = false;
const FORCE_CLEANUP = true;

describe(`project middlerware tests`, async () => {
  before(async () => {
    await initTestDatabase();
  });

  after(() => {
    concludeTesting();
  });

  // doubles as createFile test
  test(`deleteFile`, async () => {
    const fileName = `testing/cake/layers.txt`;
    const { res, cleanup } = await createDockerProject(WITHOUT_RUNNING);
    await new Promise((resolve) => {
      ProjectMiddleware.loadProject({}, res, async (err) => {
        assert.equal(!!err, false);
        res.locals.fileName = fileName;
        const { slug } = res.locals.lookups.project;
        Middleware.createFile(null, res, async (err) => {
          assert.equal(!!err, false);
          const fullPath = join(ROOT_DIR, CONTENT_DIR, slug, fileName);
          assert.equal(existsSync(fullPath), true);
          Middleware.deleteFile(null, res, async (err) => {
            assert.equal(!!err, false);
            assert.equal(existsSync(fullPath), false);
            resolve();
          });
        });
      });
    });
    await cleanup(FORCE_CLEANUP);
  });

  test(`formatFile`, async () => {
    const fileName = `testing/cake/layers.js`;
    const { res, cleanup } = await createDockerProject(WITHOUT_RUNNING);
    await new Promise((resolve) => {
      ProjectMiddleware.loadProject({}, res, async (err) => {
        assert.equal(!!err, false);
        res.locals.fileName = fileName;
        const { slug } = res.locals.lookups.project;
        const fullPath = join(ROOT_DIR, CONTENT_DIR, slug, fileName);
        mkdirSync(dirname(fullPath), { recursive: true });
        writeFileSync(fullPath, `let a      = 1  +\n2`);

        Middleware.formatFile(null, res, async (err) => {
          assert.equal(!!err, false);
          assert.equal(res.locals.formatted, true);
          const content = readFileSync(fullPath).toString(`utf-8`);
          assert.equal(content, `let a = 1 + 2;\n`);
          resolve();
        });
      });
    });
    await cleanup(FORCE_CLEANUP);
  });

  test(`getDirListing`, async () => {
    const { res, cleanup } = await createDockerProject(WITHOUT_RUNNING);
    await new Promise((resolve) => {
      ProjectMiddleware.loadProject({}, res, async (err) => {
        assert.equal(!!err, false);
        const base = join(
          ROOT_DIR,
          CONTENT_DIR,
          res.locals.lookups.project.slug,
        );
        mkdirSync(dirname(base), { recursive: true });
        const file1 = join(base, `file1.txt`);
        writeFileSync(file1, `this is some text`);
        const file2 = join(base, `file2.txt`);
        writeFileSync(file2, `this is some text too`);
        Middleware.getDirListing(null, res, async (err) => {
          assert.equal(!!err, false);
          assert.deepEqual(res.locals.dir.sort(), [`file1.txt`, `file2.txt`]);
          resolve();
        });
      });
    });
    await cleanup(FORCE_CLEANUP);
  });

  /*
  test(`getMimeType`, async () => {
    // test pending
    await new Promise((resolve) => {
      Middleware.getMimeType(req, res, (err) => {
        assert.equal(!!err, false);
        resolve();
      });
    });
  });

  test(`handleUpload`, async () => {
    // test pending
    await new Promise((resolve) => {
      Middleware.handleUpload(req, res, (err) => {
        assert.equal(!!err, false);
        resolve();
      });
    });
  });

  test(`patchFile`, async () => {
    // test pending
    await new Promise((resolve) => {
      Middleware.patchFile(req, res, (err) => {
        assert.equal(!!err, false);
        resolve();
      });
    });
  });

  test(`moveFile`, async () => {
    // test pending
    await new Promise((resolve) => {
      Middleware.createFile(req, res, (err) => {
        assert.equal(!!err, false);
        resolve();
      });
    });
  });
  */
});
