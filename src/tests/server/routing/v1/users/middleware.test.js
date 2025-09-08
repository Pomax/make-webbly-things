import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { resolve, join } from "node:path";
import {
  initTestDatabase,
  concludeTesting,
} from "../../../../../server/database/index.js";
import * as User from "../../../../../server/database/user.js";
import * as Middleware from "../../../../../server/routing/v1/users/middleware.js";

import dotenv from "@dotenvx/dotenvx";
const envPath = resolve(
  join(import.meta.dirname, `..`, `..`, `..`, `..`, `..`, `..`, `.env`),
);
dotenv.config({ quiet: true, path: envPath });

describe(`user middlerware tests`, async () => {
  before(async () => await initTestDatabase());
  after(() => concludeTesting());

  test(`checkAvailableUserName`, async () => {
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

  test(`getUserSettings`, async () => {
    const user = User.getUser(`test-user`);
    const res = {
      locals: {
        lookups: {
          user,
        },
      },
    };
    await new Promise((resolve) => {
      Middleware.getUserSettings(null, res, async (err) => {
        assert.equal(!!err, false);
        assert.deepEqual(res.locals.settings, {
          name: "test user",
          admin: false,
          enabled: true,
          suspended: false,
        });
        resolve();
      });
    });

    res.locals.lookups.user = User.getUser(`test-admin`);
    await new Promise((resolve) => {
      Middleware.getUserSettings(null, res, async (err) => {
        assert.equal(!!err, false);
        assert.deepEqual(res.locals.settings, {
          name: "test admin",
          admin: true,
          enabled: true,
          suspended: false,
        });
        resolve();
      });
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
    Middleware.reserveUserAccount(
      {
        params: { username: `Test user` },
        session: { save: () => {} },
      },
      { locals: {} },
      (err) => assert.equal(!!err, true),
    );
  });
});
