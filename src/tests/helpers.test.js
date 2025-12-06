import test, { describe } from "node:test";
import assert from "node:assert/strict";
import * as Helpers from "../helpers.js";

/*
  export function createRewindPoint( project, reason)
*/

describe(`Helper function tests`, async () => {
  test(`constants`, () => {
    const { isWindows, npm, CONTENT_BASE, CONTENT_DIR } = Helpers;
    assert.equal(isWindows, process.platform === `win32`);
    assert.equal(npm, isWindows ? `npm.cmd` : `npm`);
    assert.equal(CONTENT_BASE, process.env.CONTENT_BASE ?? `content`);
    assert.equal(CONTENT_DIR, isWindows ? CONTENT_BASE : `./${CONTENT_BASE}`);
  });

  test(`createRewindPoint`, () => {
    // test pending
  });

  test(`execPromise`, async () => {
    const result = await Helpers.execPromise(`node --version`);
    assert.equal(result[0], `v`);
  });

  test(`getFileSum`, () => {
    // NOTE: if you update the readme, this test will need to get updated too =)
    assert.equal(Helpers.getFileSum(`.`, `README.md`), 557371);
  });

  test(`getFreePort`, async () => {
    const p = await Helpers.getFreePort();
    assert.notEqual(p, 0);
  });

  test("pathExists", async () => {
    assert.equal(Helpers.pathExists(`./src`), true);
    assert.equal(Helpers.pathExists(`./lolsrc`), false);
    assert.equal(Helpers.pathExists(`./src/helpers.js`), true);
    assert.equal(Helpers.pathExists(`./src/lolhelpers.js`), false);
  });

  test(`readContentDir`, async () => {
    const { dirs, files } = Helpers.readContentDir(`./data`);
    const found = [
      `data.sqlite3`,
      `migrations/0001.sql`,
      `migrations/0002.js`,
      `migrations/0003.sql`,
      `migrations/0004.sql`,
      `migrations/0005.sql`,
      `schema.sql`,
      `README.md`,
    ].every((f) => files.includes(f));
    assert.equal(found, true);
    assert.deepEqual(dirs, ["migrations"]);
  });

  test(`safify`, () => {
    const output = Helpers.safify(`<script src="lol.js"></script>`);
    assert.equal(output, `&lt;script src="lol.js"&gt;&lt;/script&gt;`);
  });

  test(`scrubDateTime`, () => {
    const d = new Date(0).toISOString();
    const s = Helpers.scrubDateTime(d);
    assert.equal(s, `1970-01-01 00:00:00`);
  });

  test(`setDefaultAspects`, () => {
    const list = [];
    const app = {
      set: (...args) => list.push(args),
      use: (...args) => list.push(args),
    };
    Helpers.setDefaultAspects(app);
    assert.deepEqual(list[0], [`etag`, false]);
    assert.equal(list[1][0].name, `nocache`);
    assert.equal(list[2][0].name, `urlencodedParser`);
    assert.equal(list[3][0].name, `contentSecurityPolicyMiddleware`);
  });

  test(`setupGit`, () => {
    // test pending
  });

  test(`slugify`, () => {
    // tests pending because wow there's a lot of aspects to test
  });
});
