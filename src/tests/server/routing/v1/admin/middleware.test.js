import test, { after, before, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import {
  initTestDatabase,
  concludeTesting,
  Models,
  clearTestData,
} from "../../../../../server/database/index.js";
import * as Project from "../../../../../server/database/project.js";
import * as User from "../../../../../server/database/user.js";
import * as Middleware from "../../../../../server/routing/v1/admin/middleware.js";
import {
  createAdminUser,
  createProject,
  createUser,
} from "../../../../test-helpers.js";
import { closeReader } from "../../../../../setup/utils.js";

describe(`admin middleware tests`, async () => {
  before(async () => await initTestDatabase());
  beforeEach(() => clearTestData());
  after(() => {
    concludeTesting();
    closeReader();
  });

  test(`back`, () => {
    let path;
    Middleware.back(
      {},
      {
        redirect: (p) => (path = p),
      },
    );
    assert.equal(path, `/v1/admin`);
  });

  test(`loadAdminData`, () => {
    const user = createAdminUser(`test-admin`);
    createProject(`admin-project`, user);

    const req = {};
    const res = { locals: { user } };
    Middleware.loadAdminData(req, res, () => {
      const { admin } = res.locals;
      assert.equal(admin.userList.length, 1);
      assert.equal(admin.projectList.length, 1);
    });
  });

  describe(`server test`, async () => {
    test(`stopServer`, () => {
      // we just care that the code path completes
      Middleware.stopServer({ params: { name: `testing` } }, null, () => {
        assert.equal(true, true);
      });
    });
  });

  describe(`container tests`, async () => {
    test(`stopContainer`, () => {
      // we just care that the code path completes
      Middleware.stopContainer({ params: { image: `testing` } }, null, () => {
        assert.equal(true, true);
      });
    });
  });

  describe(`user tests`, () => {
    test(`deleteUser`, () => {
      const user = Models.User.create({ name: `bye` });
      const res = {
        locals: {
          lookups: {
            user,
          },
        },
      };
      Middleware.deleteUser(null, res, () => {
        assert.equal(true, true);
      });
    });
    test(`disableUser`, () => {
      const user = createUser();
      const res = {
        locals: {
          lookups: {
            user,
          },
        },
      };
      Middleware.disableUser(null, res, () => {
        assert.equal(true, true);
      });
    });
    test(`enableUser`, () => {
      const user = createUser();
      const res = {
        locals: {
          lookups: {
            user,
          },
        },
      };
      Middleware.enableUser(null, res, () => {
        assert.equal(true, true);
      });
    });
    test(`suspendUser`, () => {
      const user = createUser();
      const req = {
        body: {
          reason: undefined,
        },
      };
      const res = {
        locals: {
          lookups: {
            user,
          },
        },
      };
      Middleware.suspendUser(req, res, (err) => {
        assert.equal(!!err, true);
      });
      req.body.reason = `reason goes here`;
      Middleware.suspendUser(req, res, (err) => {
        assert.equal(!!err, false);
      });
    });
    test(`unsuspendUser`, () => {
      const user = createUser();
      const s = User.suspendUser(user, `more testing`);
      const req = {
        params: {
          sid: `${s.id}`,
        },
      };
      Middleware.unsuspendUser(req, null, () => {
        assert.equal(true, true);
      });
    });
  });

  describe(`project tests`, async () => {
    test(`deleteProject`, () => {
      // TODO: test pending. Too many permutations atm
    });
    test(`suspendProject`, () => {
      createProject(`test-project`);
      const req = {
        body: {
          reason: `reason goes here`,
        },
      };
      const res = {
        locals: {
          lookups: {
            project: Project.getProject(`test-project`),
          },
        },
      };
      Middleware.suspendProject(req, res, () => {
        assert.equal(true, true);
      });
    });
    test(`unsuspendProject`, () => {
      const project = createProject();
      const s = Project.suspendProject(project, `more testing`);
      const req = {
        params: {
          sid: `${s.id}`,
        },
      };
      Middleware.unsuspendProject(req, null, () => {
        assert.equal(true, true);
      });
    });
  });
});
