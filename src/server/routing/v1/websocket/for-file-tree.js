import http from "node:http";
import { WebSocketServer } from "ws";
import { FILE_TREE_PREFIX, OTHandler } from "./ot-handler.js";

/**
 * Set up file-tree related websocket handling given
 * an express app, and the session parser (which we
 * very much need to make sure only authenticated
 * users are allowed to establish a socket connection)
 */
export function setupFileTreeWebSocket(app, sessionParser) {
  const server = http.createServer(app);
  const wss = new WebSocketServer({ clientTracking: false, noServer: true });

  server.on("upgrade", (request, socket, head) => {
    // make sure this user is authenticated before we allow a connection:
    sessionParser(request, {}, () => {
      const { user } = request.session.passport ?? {};
      if (!user) {
        socket.write(`HTTP/1.1 401 Unauthorized\r\n\r\n`);
        socket.destroy();
        return;
      }
      // Auth is good: set up the websocket!
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit(`connection`, ws, request);
      });
    });
  });

  // Whenever a websocket connection is made, make sure
  // that socket knows how to deal with file-tree events:
  wss.on("connection", (socket, request) => {
    addFileTreeCommunication(socket, request);
  });

  return server;
}

/**
 * Anyone can use this function to tack file-tree compatible
 * message handling to a websocket.
 */
export async function addFileTreeCommunication(socket, request) {
  // you are you *sure* you're allowed in here?
  if (!request.session?.passport?.user) return;

  // Our websocket based request handler.
  const otHandler = new OTHandler(socket, request.session.passport.user);

  socket.on("message", async (message) => {
    const { type, detail, handlerName } = unpackMessage(message);
    if (!type) return;
    try {
      otHandler[handlerName](detail, request);
    } catch (e) {
      return console.warn(`Missing implementation for ${handlerName}.`);
    }
  });
}

// Helper function for parsing messages for filetree work.
function unpackMessage(message) {
  let data = message.toString();
  try {
    data = JSON.parse(data);
  } catch (e) {
    // This will not throw, because a server shouldn't crash out.
    console.warn(
      `Received incompatible data via websocket: message is not JSON.`,
      data,
      e,
    );
  }
  if (!data) return {};

  // Is this something we know how to handle?
  let { type, detail } = data;
  if (!type) {
    console.warn(`No type for message`, data);
    return {};
  }
  if (!type.startsWith(FILE_TREE_PREFIX)) {
    console.warn(`No file-tree prefix for message`, data);
    return {};
  }

  // Looks like it, let's get it processed.
  type = type.replace(FILE_TREE_PREFIX, ``);
  const handlerName = `on${type}`;
  return { type, detail, handlerName };
}
