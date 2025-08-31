// Load our server dependencies...
import express from "express";
import { join } from "node:path";
import { setDefaultAspects, execPromise } from "../helpers.js";
import { setupRoutes } from "./routing/index.js";
import { watchForRebuild } from "./watcher.js";
import { setupCaddy, startCaddy } from "./caddy/caddy.js";
import { setupTemplating } from "./pages/templating.js";
import { getMigrationStatus } from "./database/models.js";
import { scheduleContainerCheck } from "./docker/sleep-check.js";

// And our environment. Note that this kicks in AFTER
// the import tree ahs been built, so we can't actually
// rely on process.env being what it should be at the
// top level of any module that doesn't also run the
// dotenv.config function as part of its own code...
import dotenv from "@dotenvx/dotenvx";
const envPath = join(import.meta.dirname, `../../.env`);
dotenv.config({ path: envPath, quiet: true });

// Reset our caddy file
setupCaddy();

// Quick check: does docker work?
try {
  await execPromise(`docker ps`);
} catch (e) {
  console.error(e, `\nERROR: no Docker service is running!\n\n`);
  process.exit(1);
}

// Second quick check: does caddy work?
try {
  await execPromise(`caddy --version`);
} catch (e) {
  console.error(`\nERROR: Caddy does not appear to be installed!\n\n`);
  process.exit(1);
}

const PORT = process.env.PORT ?? 8000;
const { WEB_EDITOR_HOSTNAME } = process.env;

// Then set up the server:
const app = express();
setupTemplating(app);
setDefaultAspects(app);
setupRoutes(app);

app.listen(PORT, async () => {
  const missingMigrations = await getMigrationStatus();
  if (missingMigrations > 0) {
    console.error(`
Error: your datatabase is ${missingMigrations} migrations behind!

Please rerun "node setup" to ensure your database schema is up to date.
`);
    process.exit(1);
  }

  // Generate the server address notice
  const msg = `=   Server running on https://${WEB_EDITOR_HOSTNAME}   =`;
  const line = `=`.repeat(msg.length);
  const mid = `=${` `.repeat(msg.length - 2)}=`;
  console.log([``, line, mid, msg, mid, line, ``].join(`\n`));
  watchForRebuild();
  startCaddy();
  scheduleContainerCheck();
});
