// Load our server dependencies...
import express from "express";
import { join } from "node:path";
import { setDefaultAspects, execPromise, ROOT_DIR } from "../helpers.js";
import { setupRoutes } from "./routing/index.js";
import { watchForRebuild } from "./watcher.js";
import { setupCaddy, startCaddy } from "./caddy/caddy.js";
import { setupTemplating } from "./templating.js";
import { scheduleContainerCheck } from "./docker/sleep-check.js";
import { applyMigrations } from "./database/utils.js";

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
