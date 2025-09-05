import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { resolve, join } from "node:path";
import * as User from "../../../server/database/user.js";
import {
  initTestDatabase,
  concludeTesting,
  Models,
} from "../../../server/database/models.js";

import dotenv from "@dotenvx/dotenvx";
const envPath = resolve(
  join(import.meta.dirname, `..`, `..`, `..`, `..`, `.env`),
);
dotenv.config({ quiet: true, path: envPath });

describe(`user tests`, async () => {
  before(async () => await initTestDatabase());
  after(() => concludeTesting());

  /*
  export function processUserLogin(userObject) {
  */

  test(`deleteUser`, () => {
    const user = Models.User.create({ name: `disposable` });
    User.deleteUser(user);
  });

  test(`enable/disable`, () => {
    let user = User.getUser(`test user`);

    User.enableUser(user);
    user = User.getUser(`test user`);
    assert.notEqual(user.enabled_at, null);

    User.disableUser(user);
    user = User.getUser(`test user`);
    assert.equal(user.enabled_at, null);
  });

  test(`getAllUsers`, () => {
    const users = User.getAllUsers();
    assert.equal(users.length, 2);
  });

  test(`getUserAdminFlag`, () => {
    assert.equal(User.getUserAdminFlag(`test admin`), true);
    assert.equal(User.getUserAdminFlag(`test user`), false);
  });

  test(`getUserSettings`, () => {
    const admin = User.getUser(`test admin`);
    let settings = User.getUserSettings(admin.id);
    assert.deepEqual(settings, {
      name: `test admin`,
      admin: true,
      enabled: true,
      suspended: false,
    });

    const user = User.getUser(`test user`);
    const s = User.suspendUser(user.id, `why not`);
    User.disableUser(user);
    settings = User.getUserSettings(user.id);
    assert.deepEqual(settings, {
      name: `test user`,
      admin: false,
      enabled: false,
      suspended: true,
    });
  });

  test(`getUserSuspensions`, () => {
    const user = Models.User.create({ name: `sus user` });
    const s = User.suspendUser(user.id, `why not`);
    User.unsuspendUser(s.id);
    const t = User.suspendUser(user.id, `why not, again`);
    let list = User.getUserSuspensions(user.id);
    assert.equal(list.length, 1);
    list = User.getUserSuspensions(user.id, true);
    assert.equal(list.length, 2);
  });

  test(`hasAccessToUserRecords`, () => {
    const admin = User.getUser(`test admin`);
    const user = User.getUser(`test user`);
    const rando = Models.User.create({ name: `rando calrisian` });

    assert.equal(User.hasAccessToUserRecords(user.id, user.id), true);
    assert.equal(User.hasAccessToUserRecords(admin.id, user.id), true);
    assert.equal(User.hasAccessToUserRecords(user.id, rando.id), false);
  });
});
