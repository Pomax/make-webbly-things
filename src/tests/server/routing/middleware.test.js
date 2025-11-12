import test, { after, before, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import * as Middleware from "../../../server/routing/middleware.js";

import {
  initTestDatabase,
  concludeTesting,
  getProjectOwners,
  clearTestData,
} from "../../../server/database/index.js";
import { closeReader } from "../../../setup/utils.js";
import {
  createAdminUser,
  createProject,
  createStarterProject,
  createUser,
  WITHOUT_SETTINGS,
} from "../../test-helpers.js";

describe(`Universal middleware tests`, async () => {
  before(async () => await initTestDatabase());
  beforeEach(() => clearTestData());
  after(() => {
    concludeTesting();
    closeReader();
  });

  test(`nocache`, async () => {
    const headers = {};

    const res = {
      setHeader: (k, v) => (headers[k] = v),
    };

    Middleware.nocache(null, res, () => {
      assert.deepEqual(headers, {
        "Surrogate-Control": "no-store",
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        Expires: "0",
      });
    });
  });

  test(`noStaticHTML`, async () => {
    Middleware.noStaticHTML(
      {
        path: `cake.html`,
      },
      null,
      (err) => {
        assert.equal(!!err, true);
      },
    );
  });

  test(`pageNotFound`, () => {
    Middleware.pageNotFound(
      {
        query: { preview: true },
      },
      {
        status: (code) => {
          assert.equal(code, 404);
          return { send: () => {} };
        },
      },
    );
  });

  test(`verifyAdmin`, async () => {
    const admin = createAdminUser();
    const res = {
      locals: {
        user: admin,
      },
    };
    Middleware.verifyAdmin(null, res, () => {
      assert.equal(res.locals.adminCall, true);
    });
  });

  test("verifyAccesToUser", async () => {
    const user = createUser();
    const res = {
      locals: {
        user,
        lookups: {
          user,
        },
      },
    };
    Middleware.verifyAccesToUser(null, res, (err) => {
      assert.equal(!!err, false);
    });
  });

  test("verifyEditRights", async () => {
    const user = createUser();
    const project = createProject(`test-project`, user);
    const res = {
      locals: {
        user,
        lookups: {
          user,
          project,
        },
      },
    };
    Middleware.verifyEditRights(null, res, (err) => {
      assert.equal(!!err, false);
    });
  });

  test("verifyOwner", async () => {
    const user = createUser();
    const project = createProject(`test-project`, user);
    const res = {
      locals: {
        user,
        lookups: {
          user,
          project,
        },
      },
    };
    Middleware.verifyOwner(null, res, (err) => {
      assert.equal(!!err, false);
    });
  });

  test("loadProjectList", async () => {
    const user = createUser();
    const project = createProject(`test-project`, user, WITHOUT_SETTINGS);
    project.owners = getProjectOwners(project);
    const res = {
      locals: {
        user,
      },
    };
    Middleware.loadProjectList(null, res, () => {
      assert.deepEqual(res.locals.projectList, [project]);
    });
  });

  test("loadProviders", async () => {
    const res = { locals: {} };
    Middleware.loadProviders(null, res, () => {
      assert.deepEqual(res.locals.availableProviders, [
        {
          service: "github",
          service_domain: undefined,
        },
        {
          service: "google",
          service_domain: undefined,
        },
        {
          service: "mastodon",
          service_domain: "mastodon.social",
        },
      ]);
    });
  });

  test("loadStarters", async () => {
    const starter = createStarterProject(
      `test-starter`,
      `test-user`,
      WITHOUT_SETTINGS,
    );
    const res = { locals: {} };
    Middleware.loadStarters(null, res, () => {
      assert.deepEqual(res.locals.starters, [starter]);
    });
  });

  test("loadProjectList", async () => {
    const user = createUser();
    const project = createProject(`test-project`, user, WITHOUT_SETTINGS);
    project.owners = getProjectOwners(project);
    const res = {
      locals: {
        user,
      },
    };
    Middleware.loadProjectList(null, res, () => {
      assert.deepEqual(res.locals.projectList, [project]);
    });
  });
});
