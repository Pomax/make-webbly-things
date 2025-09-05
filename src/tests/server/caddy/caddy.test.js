import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { resolve, join } from "node:path";
import * as Caddy from "../../../server/caddy/caddy.js";

import dotenv from "@dotenvx/dotenvx";
const envPath = resolve(
  join(import.meta.dirname, `..`, `..`, `..`, `..`, `.env`)
);
dotenv.config({ quiet: true, path: envPath });

const bindings = Caddy.portBindings;

const project = {
  id: 1,
  name: `testing fun times`,
  slug: `testing-fun-times`,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe(`Caddy test`, async () => {
  test(`setupCaddy`, () => {
    Caddy.setupCaddy();
  });

  test(`stopCaddy`, () => {
    Caddy.stopCaddy();
  });

  test(`startCaddy`, () => {
    Caddy.startCaddy();
    assert.strictEqual(bindings[project.slug], undefined);
  });

  test(`updateCaddyFile`, () => {
    Caddy.updateCaddyFile(project, 0);
    assert.deepEqual(bindings[project.slug], { port: 0 });
  });

  test(`removeCaddyEntry`, () => {
    Caddy.removeCaddyEntry(project);
    assert.strictEqual(bindings[project.slug], undefined);
  });
});
