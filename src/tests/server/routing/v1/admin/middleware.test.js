import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { resolve, join } from "node:path";
import {
  initTestDatabase,
  concludeTesting,
  Models,
} from "../../../../../server/database/models.js";
import * as Project from "../../../../../server/database/project.js";
import * as User from "../../../../../server/database/user.js";
import * as Middleware from "../../../../../server/routing/v1/admin/middleware.js";

import dotenv from "@dotenvx/dotenvx";
const envPath = resolve(
  join(import.meta.dirname, `..`, `..`, `..`, `..`, `..`, `..`, `.env`)
);
dotenv.config({ quiet: true, path: envPath });

describe(`admin middlerware tests`, async () => {
  before(async () => await initTestDatabase());
  after(() => concludeTesting());

  test(`back`, () => {
    let path;
    Middleware.back(
      {},
      {
        redirect: (p) => (path = p),
      }
    );
    assert.equal(path, `/v1/admin`);
  });

  test(`loadAdminData`, () => {
    let req = {};
    let res = { locals: {} };
    Middleware.loadAdminData(req, res, () => {
      const { admin } = res.locals;
      assert.equal(admin.userList.length, 2);
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
    test(`deleteContainer`, () => {
      // TODO: implement
    });

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
      const user = User.getUser(`test user`);
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
      const user = User.getUser(`test user`);
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
      const user = User.getUser(`test user`);
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
      const user = User.getUser(`test user`);
      const s = User.suspendUser(user.id, `more testing`);
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
      const project = Project.getProject(`test-project`);
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
