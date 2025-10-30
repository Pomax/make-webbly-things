// Load our server dependencies...
import express from "express";
import { join } from "node:path";
import { setDefaultAspects, ROOT_DIR } from "../helpers.js";
import { setupRoutes } from "./routing/index.js";
import { watchForRebuild } from "./watcher.js";
import { setupCaddy, startCaddy } from "./caddy/caddy.js";
import { setupTemplating } from "./templating.js";
import { scheduleContainerCheck } from "./docker/sleep-check.js";

// And our environment. Note that this kicks in AFTER
// the import tree ahs been built, so we can't actually
// rely on process.env being what it should be at the
// top level of any module that doesn't also run the
// dotenv.config function as part of its own code...
import dotenv from "@dotenvx/dotenvx";
import { applyMigrations } from "./database/utils.js";
const envPath = join(import.meta.dirname, `../../.env`);
dotenv.config({ path: envPath, quiet: true });

const PORT = process.env.PORT ?? 8000;
const { WEB_EDITOR_HOSTNAME } = process.env;

// Set up the server:
const app = express();
setupTemplating(app);
setDefaultAspects(app);
const server = setupRoutes(app);

server.listen(PORT, async () => {
  // Ensure the database is up to date
  await applyMigrations(join(ROOT_DIR, `data`, `data.sqlite3`));

  // Generate the server address notice
  const msg = `=   Server running on https://${WEB_EDITOR_HOSTNAME}   =`;
  const line = `=`.repeat(msg.length);
  const mid = `=${` `.repeat(msg.length - 2)}=`;
  console.log([``, line, mid, msg, mid, line, ``].join(`\n`));
  watchForRebuild();
  setupCaddy();
  startCaddy();
  scheduleContainerCheck();
});
