import test, { after, describe } from "node:test";
import assert from "node:assert/strict";

import {
  setupGithubAuth,
  setupGoogleAuth,
  setupMastodonAuth,
} from "../../setup/auth-providers.js";

import { answer } from "../test-helpers.js";
import { closeReader } from "../../setup/utils.js";

const autoFill = {
  GITHUB_CLIENT_ID: `github client id`,
  GITHUB_CLIENT_SECRET: `github client secret`,
  GOOGLE_CLIENT_ID: `google client id`,
  GOOGLE_CLIENT_SECRET: `google client secret`,
  MASTODON_OAUTH_DOMAIN: `mastodon oauth domain`,
  MASTODON_CLIENT_ID: `mastodon client id`,
  MASTODON_CLIENT_SECRET: `mastodon client secret`,
};

describe(`auth provider setup tests`, async () => {
  after(() => closeReader());

  test(`setupGithubAuth`, async () => {
    const { GITHUB_CLIENT_ID: a, GITHUB_CLIENT_SECRET: b } =
      await setupGithubAuth({
        GITHUB_CLIENT_ID: `a`,
        GITHUB_CLIENT_SECRET: `b`,
      });
    assert.equal(a, `a`);
    assert.equal(b, `b`);

    const { GITHUB_CLIENT_ID: c, GITHUB_CLIENT_SECRET: d } =
      await setupGithubAuth({}, autoFill);
    assert.equal(c, autoFill.GITHUB_CLIENT_ID);
    assert.equal(d, autoFill.GITHUB_CLIENT_SECRET);

    const no = setupGithubAuth({ WEB_EDITOR_HOSTNAME: `localhost` });
    await answer(`n`);
    const result = await no;
    assert.deepEqual(result, {});

    const yes = setupGithubAuth({ WEB_EDITOR_HOSTNAME: `localhost` });
    await answer(`Y`);
    await answer(`e`);
    await answer(`f`);
    const { GITHUB_CLIENT_ID: e, GITHUB_CLIENT_SECRET: f } = await yes;
    assert.equal(e, `e`);
    assert.equal(f, `f`);
  });

  test(`setupGoogleAuth`, async () => {
    const { GOOGLE_CLIENT_ID: a, GOOGLE_CLIENT_SECRET: b } =
      await setupGoogleAuth({
        GOOGLE_CLIENT_ID: `a`,
        GOOGLE_CLIENT_SECRET: `b`,
      });
    assert.equal(a, `a`);
    assert.equal(b, `b`);

    const { GOOGLE_CLIENT_ID: c, GOOGLE_CLIENT_SECRET: d } =
      await setupGoogleAuth({}, autoFill);
    assert.equal(c, autoFill.GOOGLE_CLIENT_ID);
    assert.equal(d, autoFill.GOOGLE_CLIENT_SECRET);

    const no = setupGoogleAuth({ WEB_EDITOR_HOSTNAME: `localhost` });
    await answer(`n`);
    const result = await no;
    assert.deepEqual(result, {});

    const yes = setupGoogleAuth({ WEB_EDITOR_HOSTNAME: `localhost` });
    await answer(`Y`);
    await answer(`e`);
    await answer(`f`);
    const { GOOGLE_CLIENT_ID: e, GOOGLE_CLIENT_SECRET: f } = await yes;
    assert.equal(e, `e`);
    assert.equal(f, `f`);
  });

  test(`setupMastodonAuth`, async () => {
    const {
      MASTODON_OAUTH_DOMAIN: x,
      MASTODON_CLIENT_ID: a,
      MASTODON_CLIENT_SECRET: b,
    } = await setupMastodonAuth({
      MASTODON_OAUTH_DOMAIN: `x`,
      MASTODON_CLIENT_ID: `a`,
      MASTODON_CLIENT_SECRET: `b`,
    });
    assert.equal(x, `x`);
    assert.equal(a, `a`);
    assert.equal(b, `b`);

    const {
      MASTODON_OAUTH_DOMAIN: y,
      MASTODON_CLIENT_ID: c,
      MASTODON_CLIENT_SECRET: d,
    } = await setupMastodonAuth({}, autoFill);
    assert.equal(y, autoFill.MASTODON_OAUTH_DOMAIN);
    assert.equal(c, autoFill.MASTODON_CLIENT_ID);
    assert.equal(d, autoFill.MASTODON_CLIENT_SECRET);

    const no = setupMastodonAuth({ WEB_EDITOR_HOSTNAME: `localhost` });
    await answer(`n`);
    const result = await no;
    assert.deepEqual(result, {});

    const yes = setupMastodonAuth({ WEB_EDITOR_HOSTNAME: `localhost` });
    await answer(`Y`);
    await answer(`z`);
    await answer(`e`);
    await answer(`f`);
    const {
      MASTODON_OAUTH_DOMAIN: z,
      MASTODON_CLIENT_ID: e,
      MASTODON_CLIENT_SECRET: f,
    } = await yes;
    assert.equal(z, `z`);
    assert.equal(e, `e`);
    assert.equal(f, `f`);
  });
});
