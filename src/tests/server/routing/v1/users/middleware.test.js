import test, { after, before, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import {
  initTestDatabase,
  concludeTesting,
  clearTestData,
} from "../../../../../server/database/index.js";
import * as Middleware from "../../../../../server/routing/v1/users/middleware.js";
import { createUser } from "../../../../test-helpers.js";
import { closeReader } from "../../../../../setup/utils.js";

describe(`user middlerware tests`, async () => {
  before(async () => await initTestDatabase());
  beforeEach(() => clearTestData());
  after(() => {
    concludeTesting();
    closeReader();
  });

  test(`checkAvailableUserName`, async () => {
    createUser(`test-user`);
    const badRes = { locals: {} };
    Middleware.checkAvailableUserName(
      { params: { username: `test-user` } },
      badRes,
      () => {
        assert.equal(badRes.locals.available, false);
      },
    );
    const goodRes = { locals: {} };
    Middleware.checkAvailableUserName(
      { params: { username: `test-user-2` } },
      goodRes,
      () => {
        assert.equal(goodRes.locals.available, true);
      },
    );
  });

  test(`getUserProfile`, async () => {
    const user = createUser();
    const res = { locals: { user, lookups: { user: user } } };
    Middleware.getUserProfile(null, res, () => {
      const { profile } = res.locals;
      assert.equal(profile.user.bio, user.bio);
      assert.equal(profile.ownProfile, true);
    });
  });

  test(`reserveUserAccount`, async () => {
    const req = {
      params: { username: `Princess Bride` },
      session: {
        save: () => {},
      },
    };
    Middleware.reserveUserAccount(req, { locals: {} }, () => {
      const reservedAccount = {
        username: `Princess Bride`,
        slug: `princess-bride`,
      };
      assert.deepEqual(req.session.reservedAccount, reservedAccount);
    });

    createUser(`Test user`);
    Middleware.reserveUserAccount(
      {
        params: { username: `Test user` },
        session: { save: () => {} },
      },
      { locals: {} },
      (err) => assert.equal(!!err, true),
    );
  });

  test(`updateUserProfile`, async () => {
    const user = createUser();
    const req = {
      body: {
        bio: `This is an updated text`,
        linkNames: [],
        linkHrefs: [],
        linkOrder: [],
      },
    };
    const res = { locals: { user, lookups: { user: user } } };
    Middleware.updateUserProfile(req, res, () => {
      const { profile } = res.locals;
      assert.equal(profile.user.bio, req.body.bio);
    });
  });
});
