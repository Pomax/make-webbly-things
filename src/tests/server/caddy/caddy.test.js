import test, { describe } from "node:test";
import assert from "node:assert/strict";
import * as Caddy from "../../../server/caddy/caddy.js";

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
    assert.deepEqual(bindings[project.slug], new Caddy.PortBinding(0));
  });

  test(`removeCaddyEntry`, () => {
    Caddy.removeCaddyEntry(project);
    assert.strictEqual(bindings[project.slug], undefined);
  });
});
