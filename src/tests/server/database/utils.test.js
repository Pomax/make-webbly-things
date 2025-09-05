import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { resolve, join } from "node:path";
import * as Utils from "../../../server/database/utils.js";

import dotenv from "@dotenvx/dotenvx";
const envPath = resolve(
  join(import.meta.dirname, `..`, `..`, `..`, `..`, `.env`),
);
dotenv.config({ quiet: true, path: envPath });

describe(`util test`, async () => {
  test(`composeWhere`, () => {
    const data = {
      a: `b`,
      c: 123,
      d: new Date().toISOString(),
      updated_at: "now",
    };
    const { filter, values } = Utils.composeWhere(data);
    assert.equal(filter, `a = ? AND c = ? AND d = ?`);
    assert.deepEqual(values, [data.a, data.c, data.d]);
  });
});
