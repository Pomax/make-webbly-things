import sqlite3 from "better-sqlite3";
import test, { after, describe, before } from "node:test";
import assert from "node:assert/strict";
import * as Utils from "../../setup/utils.js";
import { cpSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathExists, ROOT_DIR } from "../../helpers.js";
import { tryFor } from "../test-helpers.js";
import dotenv from "@dotenvx/dotenvx";

const { SETUP_ROOT_DIR } = Utils;

const autoFill = {
  LOCAL_DEV_TESTING: `false`,
  USE_WEBSOCKETS: `true`,
  USE_LIVE_EMBEDS: `false`,
  WEB_EDITOR_HOSTNAME: `localhost`,
  WEB_EDITOR_APPS_HOSTNAME: `app.localhost`,
  WEB_EDITOR_IMAGE_NAME: `test-image-for-platform-setup`,
  GITHUB_CLIENT_ID: `github client id`,
  GITHUB_CLIENT_SECRET: `github client secret`,
  GOOGLE_CLIENT_ID: `google client id`,
  GOOGLE_CLIENT_SECRET: `google client secret`,
  MASTODON_OAUTH_DOMAIN: `mastodon oauth domain`,
  MASTODON_CLIENT_ID: `mastodon client id`,
  MASTODON_CLIENT_SECRET: `mastodon client secret`,
  SETUP_TLS: `y`,
  TLS_DNS_PROVIDER: `dns provider`,
  TLS_DNS_API_KEY: `dns api key`,
};

Utils.checkNodeVersion();
Utils.runNpmInstall();
Utils.closeReader();

const recursive = { recursive: true };

describe(`Setup script tests`, async () => {
  before(async () => {
    mkdirSync(join(SETUP_ROOT_DIR, `content`), recursive);
    cpSync(
      join(ROOT_DIR, `content`, `__starter_projects`),
      join(SETUP_ROOT_DIR, `content`, `__starter_projects`),
      recursive,
    );
    cpSync(join(ROOT_DIR, `data`), join(SETUP_ROOT_DIR, `data`), recursive);
    rmSync(join(SETUP_ROOT_DIR, `data`, `data.sqlite3`), { force: true });
    await tryFor(() => {
      if (!pathExists(SETUP_ROOT_DIR)) {
        throw new Error(`come on`);
      }
    });
  });

  after(() => {
    rmSync(SETUP_ROOT_DIR, { recursive: true, force: true });
    Utils.closeReader();
  });

  test(`runSetup`, async () => {
    await import(`../../setup/index.js`)
      .then((lib) => {
        const { runSetup } = lib;
        assert.equal(!!runSetup, true);
        // TODO: what can we test here?
      })
      .catch((e) => {
        console.error(e);
        assert.equal(true, false);
      });
  });
  test(`dependencies`, async () => {
    const { checkDependencies } = await import(`../../setup/dependencies.js`);
    assert.equal(!!checkDependencies, true);
    try {
      checkDependencies();
      assert.equal(true, true);
    } catch (e) {
      console.error(e);
      assert.equal(true, false);
    }
  });

  test(`setupEnv`, async () => {
    const { setupEnv } = await import(`../../setup/env.js`);
    assert.equal(!!setupEnv, true);
    await setupEnv(false, {}, autoFill);
    // See https://github.com/dotenvx/dotenvx/issues/673
    const asWritten = readFileSync(join(SETUP_ROOT_DIR, `.env`)).toString();
    const env = dotenv.parse(asWritten, { processEnv: {} });
    for (const [key, value] of Object.entries(env)) {
      assert.equal(value, env[key]);
    }
  });

  test.skip(`setupDocker`, async () => {
    // This is too hands on to test. We should almost never need to
    // fiddle with the docker images, and whoever does knows damn
    // well they better make personally sure things work =)
  });

  test(`setupSqlite`, async () => {
    const { setupSqlite } = await import(`../../setup/sqlite.js`);
    assert.equal(!!setupSqlite, true);

    await setupSqlite();

    // confirm the database was written correctly?
    const dbPath = join(SETUP_ROOT_DIR, `data`, `data.sqlite3`);
    const db = sqlite3(dbPath);
    let version = db.prepare(`PRAGMA user_version`).get().user_version;
    db.close();
    assert.equal(version, 6);
  });
});
