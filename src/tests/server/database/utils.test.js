import test, { describe } from "node:test";
import assert from "node:assert/strict";
import * as Utils from "../../../server/database/utils.js";

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
