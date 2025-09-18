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
import { setupFileTreeWebSocket } from "./server-side-file-tree.js";

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
  const sessionParser = session({
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
  });

  app.use(sessionParser);
  return sessionParser;
}

/**
 * The main function for this module: set up all URL responses.
 */
export function setupRoutes(app) {
  // Add some poor man's logging
  app.use(log);

  // We're going to need sessions
  const sessionParser = addSessionManagement(app);

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

  // TEST: websocket routing:
  return setupFileTreeWebSocket(app, sessionParser);
}

// // TEST: websocket routing:
// function setupWebSocket(app, sessionParser) {
//   const watchers = {};
//   const listeners = {};

//   const server = http.createServer(app);
//   const wss = new WebSocketServer({ clientTracking: false, noServer: true });

//   // Set up session-backed websocket negotiation:
//   server.on("upgrade", function (request, socket, head) {
//     socket.on("error", console.error);
//     sessionParser(request, {}, () => {
//       const { user } = request.session.passport ?? {};
//       if (!user) {
//         socket.write(`HTTP/1.1 401 Unauthorized\r\n\r\n`);
//         socket.destroy();
//         return;
//       }
//       console.log(`Session is parsed, user is ${user.id}!`);
//       socket.removeListener("error", console.error);
//       wss.handleUpgrade(request, socket, head, (ws) => {
//         wss.emit(`connection`, ws, request);
//       });
//     });
//   });

//   // Then set up our websocket messaging protocol:
//   wss.on(`connection`, (ws, request) => {
//     ws.on(`error`, console.error);

//     const { user } = request.session.passport ?? {};

//     ws.on(`message`, (message) => {
//       let event;
//       try {
//         event = JSON.parse(message.toString());
//       } catch (e) {
//         return;
//       }

//       const { eventType, detail } = event;

//       // "I am opening this file" call
//       if (eventType === `load`) {
//         const { path } = detail;
//         console.log(`${user.name} wants access to ${path}`);
//         listeners[path] ??= [];
//         listeners[path].push(ws);
//         const fullPath = join(ROOT_DIR, CONTENT_DIR, path);
//         ws.send(
//           JSON.stringify({
//             eventType: `file`,
//             path,
//             data: readFileSync(fullPath),
//             version: lstatSync(fullPath).atime,
//           })
//         );
//       }

//       // "I am making this edit" call
//       if (eventType === `ot`) {
//         const { path, diff, version } = detail;
//         console.log(`${user.name} edited ${path}`);
//         handleOT(listeners, path, diff, version);
//       }
//     });
//     ws.on("close", () => {});
//   });

//   return server;
// }

// // FIXME: we need a history of atime + ops, so that we can inform
// //        listeners which changes were made to which version.
// function handleOT(listeners, path, diff, version) {

// }
