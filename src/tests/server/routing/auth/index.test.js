import test, { describe } from "node:test";
import assert from "node:assert/strict";
import * as Auth from "../../../../server/routing/auth/index.js";
import * as User from "../../../../server/database/user.js";
import {
  initTestDatabase,
  concludeTesting,
} from "../../../../server/database/index.js";

const genericSettings = {
  clientID: `irrelevant`,
  clientSecret: `irrelevant`,
  callbackURL: `http://example.com`,
  passReqToCallback: true,
};

describe(`Auth function tests`, async () => {
  test(`processOAuthLogin`, async () => {
    await initTestDatabase();
    const user = User.getUser(`test-user`);
    const userObject = {
      service: `someservice`,
      service_id: 12345,
    };
    User.addLoginProviderForUser(user, userObject);
    const req = {
      session: {
        save: () => {},
      },
    };
    const profile = {
      displayName: `Test User`,
      provider: userObject.service,
      id: userObject.service_id,
    };
    Auth.processOAuthLogin(req, null, null, profile, (err, loginUser) => {
      assert.equal(!!err, false);
      assert.deepEqual(loginUser, { ...user, admin: false });
      concludeTesting();
    });
    // TODO: there are two more code paths: sign up, and adding a provider
  });

  test(`addGithubAuth`, () => {
    const app = {
      use: (path, router) => (app[path] = router),
    };
    Auth.addGithubAuth(app, genericSettings);
    const router = app[`/auth/github`];
    assert.equal(!!router, true);
    // TODO: we probably want some more detailed testing here
  });

  test(`addGoogleAuth`, () => {
    const app = {
      use: (path, router) => (app[path] = router),
    };
    Auth.addGoogleAuth(app, genericSettings);
    const router = app[`/auth/google`];
    assert.equal(!!router, true);
    // TODO: we probably want some more detailed testing here
  });

  test(`addMastodonAuth`, () => {
    const app = {
      use: (path, router) => (app[path] = router),
    };
    Auth.addMastodonAuth(app, genericSettings);
    const router = app[`/auth/mastodon`];
    assert.equal(!!router, true);
    // TODO: we probably want some more detailed testing here
  });

  test(`addEmailAuth`, () => {
    const app = {
      use: (path, router) => (app[path] = router),
    };
    Auth.addEmailAuth(app, {
      secret: `irrelevant`,
      userFields: [`irrelevant`],
      tokenField: `token`,
      verifyUserAfterToken: true,
    });
    const router = app[`/auth/email`];
    assert.equal(!!router, true);
    // TODO: we probably want some more detailed testing here
  });
});
