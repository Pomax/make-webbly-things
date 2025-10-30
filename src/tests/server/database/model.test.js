import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import * as Models from "../../../server/database/models.js";
import {
  getMigrationStatus,
  initTestDatabase,
  concludeTesting,
} from "../../../server/database/index.js";

describe(`Model tests`, async () => {
  before(async () => await initTestDatabase());
  after(() => concludeTesting());

  test(`constants`, () => {
    assert.equal(Models.UNKNOWN_USER, -1);
    assert.equal(Models.NOT_ACTIVATED, -2);
    assert.equal(Models.ADMIN, 100);
    assert.equal(Models.OWNER, 30);
    assert.equal(Models.EDITOR, 20);
    assert.equal(Models.MEMBER, 10);
  });

  test(`getMigrationStatus`, async () => {
    assert.equal(await getMigrationStatus(), 0);
  });

  test(`runQuery`, () => {
    const result = Models.runQuery(
      `select * from sqlite_master where type = ? and name = ?`,
      ["table", "users"],
    );
    assert.equal(result.length > 0, true);
    const { sql } = result[0];
    assert.equal(
      sql.includes(`created_at TEXT DEFAULT CURRENT_TIMESTAMP`),
      true,
    );
  });

  test(`models`, () => {
    assert.equal(Models.Models.Access.table, `project_access`);
    assert.equal(Models.Models.Admin.table, `admin_table`);
    assert.equal(Models.Models.Login.table, `user_logins`);
    assert.equal(Models.Models.Project.table, `projects`);
    assert.equal(Models.Models.ProjectSettings.table, `project_settings`);
    assert.equal(Models.Models.ProjectSuspension.table, `suspended_projects`);
    assert.equal(Models.Models.Remix.table, `remix`);
    assert.equal(Models.Models.StarterProject.table, `starter_projects`);
    assert.equal(Models.Models.User.table, `users`);
    assert.equal(Models.Models.UserSuspension.table, `suspended_users`);
  });
});
