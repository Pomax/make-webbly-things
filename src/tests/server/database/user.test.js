import test, { after, afterEach, before, describe } from "node:test";
import assert from "node:assert/strict";
import * as User from "../../../server/database/user.js";
import {
  initTestDatabase,
  concludeTesting,
  clearTestData,
} from "../../../server/database/index.js";
import { createAdminUser, createUser } from "../../test-helpers.js";
import { closeReader } from "../../../setup/utils.js";

describe(`user tests`, async () => {
  before(async () => await initTestDatabase());
  afterEach(() => clearTestData());
  after(() => {
    concludeTesting();
    closeReader();
  });

  /*
  export function processUserLogin(userObject) {
  */

  test(`deleteUser`, () => {
    const user = createUser();
    User.deleteUser(user);
  });

  test(`enable/disable`, () => {
    let user = createUser();

    User.enableUser(user);
    user = User.getUser(user.id);
    assert.notEqual(user.enabled_at, null);

    User.disableUser(user);
    user = User.getUser(user.id);
    assert.equal(user.enabled_at, null);
  });

  test(`getAllUsers`, () => {
    createUser(`test-user-1`);
    createUser(`test-user-2`);
    const users = User.getAllUsers();
    assert.equal(users.length, 2);
  });

  test(`userIsAdmin`, () => {
    const admin = createAdminUser();
    const user = createUser();

    assert.equal(User.userIsAdmin(admin), true);
    assert.equal(User.userIsAdmin(user), false);
  });

  test(`getUserSuspensions`, () => {
    const user = createUser();
    const s = User.suspendUser(user, `why not`);
    User.unsuspendUser(s.id);
    User.suspendUser(user, `why not, again`);
    let list = User.getUserSuspensions(user);
    assert.equal(list.length, 1);
    list = User.getUserSuspensions(user, true);
    assert.equal(list.length, 2);
  });

  test(`hasAccessToUserRecords`, () => {
    const admin = createAdminUser(`test-admin`);
    const user = createUser(`test-user`);
    const rando = createUser(`random-user`);

    assert.equal(User.hasAccessToUserRecords(user, user), true);
    assert.equal(User.hasAccessToUserRecords(admin, user), true);
    assert.equal(User.hasAccessToUserRecords(user, rando), false);
  });
});
