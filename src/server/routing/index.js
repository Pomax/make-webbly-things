import express from "express";
import session from "express-session";
import sqlite3 from "better-sqlite3";
import betterSQLite3Store from "better-sqlite3-session-store";
import {
  bindCommonValues,
  loadProjectList,
  loadProviders,
  loadStarters,
  noStaticHTML,
  pageNotFound,
} from "./middleware.js";
import { addPassportAuth } from "./auth/index.js";
import { setupRoutesV1 } from "./v1/setup-routes.js";
import { scrubDateTime } from "../../helpers.js";

const FIFTEEN_MINUTES_IN_MS = 15 * 60 * 1000;

/**
 * Naive logging for dev work.
 */
function log(req, _res, next) {
  const time = scrubDateTime(new Date().toISOString());
  console.log(`${req.method} [${time}] ${req.url}`);
  next();
}

/**
 * Our "last stop" error handler.
 */
function internalErrorHandler(err, req, res, next) {
  console.error(err);
  res.status(500).send(err.message);
}

/**
 * Session management, backed by a sqlite3 database
 * so that sessions can be persisted across restarts.
 */
function addSessionManagement(app) {
  const SQLite3Store = betterSQLite3Store(session);
  const sessionsDB = new sqlite3("./data/sessions.sqlite3");
  app.use(
    session({
      cookie: {
        httpOnly: true,
      },
      resave: false,
      saveUninitialized: false,
      secret: process.env.SESSION_SECRET,
      store: new SQLite3Store({
        client: sessionsDB,
        expired: {
          clear: true,
          intervalMs: FIFTEEN_MINUTES_IN_MS,
        },
      }),
    }),
  );
}

/**
 * The main function for this module: set up all URL responses.
 */
export function setupRoutes(app) {
  // Add some poor man's logging
  app.use(log);

  // We're going to need sessions
  addSessionManagement(app);

  // passport-mediated login routes
  addPassportAuth(app);

  // all our other routes!
  setupRoutesV1(app);

  // ...and the main page
  app.get(
    `/`,
    bindCommonValues,
    loadProjectList, // either user list, or global "most recent"
    loadProviders,
    loadStarters,
    (req, res) =>
      res.render(`main.html`, {
        currentTime: Date.now(),
        ...process.env,
        ...res.locals,
        ...req.session,
      }),
  );

  // static routes for the website itself
  app.use(`/`, noStaticHTML, express.static(`public`, { etag: false }));
  app.use(`/default`, express.static(`content/default`, { etag: false }));

  // What do we do with a 404?
  app.use(pageNotFound);

  // And terminal error handling.
  app.use(internalErrorHandler);
}
