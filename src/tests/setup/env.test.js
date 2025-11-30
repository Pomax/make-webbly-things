import test, { after, describe } from "node:test";
import assert from "node:assert/strict";
import { setupEnv } from "../../setup/env.js";

import { answer } from "../test-helpers.js";
import { closeReader } from "../../setup/utils.js";

const autoFill = {
  DOCKER_EXECUTABLE: `podman`,
  LOCAL_DEV_TESTING: `false`,
  USE_WEBSOCKETS: `false`,
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

describe(`Setup env writing test`, async () => {
  after(() => closeReader());

  test(`setupEnv`, async () => {
    const env = {};
    const check = Object.assign({}, autoFill);
    const setup = setupEnv(true, env, autoFill);

    await answer(autoFill.WEB_EDITOR_HOSTNAME, `WEB_EDITOR_HOSTNAME`);
    await answer(autoFill.WEB_EDITOR_APPS_HOSTNAME, `WEB_EDITOR_APPS_HOSTNAME`);
    await answer(autoFill.DOCKER_EXECUTABLE, `DOCKER_EXECUTABLE`);
    await answer(autoFill.WEB_EDITOR_IMAGE_NAME, `WEB_EDITOR_IMAGE_NAME`);

    await setup;
    env.SETUP_TLS = autoFill.SETUP_TLS;

    check.WEB_EDITOR_APP_SECRET = env.WEB_EDITOR_APP_SECRET;
    check.GITHUB_CALLBACK_URL = env.GITHUB_CALLBACK_URL;
    check.GOOGLE_CALLBACK_URL = env.GOOGLE_CALLBACK_URL;
    check.MASTODON_CALLBACK_URL = env.MASTODON_CALLBACK_URL;

    assert.deepEqual(env, check);
  });
});
