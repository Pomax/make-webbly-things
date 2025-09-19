import http from "node:http";
import { join, dirname } from "node:path";
import { WebSocketServer } from "ws";
import { randomUUID } from "node:crypto";
import { CONTENT_DIR, readContentDir } from "../../helpers.js";
import { getProject, hasAccessToProject, touch } from "../database/index.js";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { applyPatch } from "../../../public/vendor/diff.js";

// Scope all events to the file tree
const FILETREE_PREFIX = `file-tree:`;

/**
 * The default update handler is a diff/patch handler.
 */
const DEFAULT_HANDLER = function updateHandler(fullPath, type, update) {
  if (type === `diff`) {
    // console.log(`applying diff`, update);
    const oldContent = readFileSync(fullPath).toString();
    const newContent = applyPatch(oldContent, update);
    if (newContent) {
      writeFileSync(fullPath, newContent.toString());
    } else {
      console.log(`could not apply diff?`, {
        oldContent,
        update,
      });
    }
  } else {
    console.warn(`Unknown update type "${type}" in file:update handler.`);
  }
};

/**
 * ...docs go here...
 */
export function setupFileTreeWebSocket(app, sessionParser) {
  // Set up websocket functionality
  const server = http.createServer(app);
  const wss = new WebSocketServer({ clientTracking: false, noServer: true });
  server.on("upgrade", (request, socket, head) => {
    sessionParser(request, {}, () => {
      const { user } = request.session.passport ?? {};
      if (!user) {
        socket.write(`HTTP/1.1 401 Unauthorized\r\n\r\n`);
        socket.destroy();
        return;
      }
      console.log(`Session is parsed, user is ${user.id}!`);
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit(`connection`, ws, request);
      });
    });
  });

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
    // This will not throw, because a server shouldn't crash out.
    let data = message.toString();
    try {
      data = JSON.parse(data);
    } catch (e) {
      console.warn(
        `Received incompatible data via websocket: message is not JSON.`,
        data,
      );
    }
    if (!data) return;

    // Is this something we know how to handle?
    let { type, detail } = data;
    if (!type) return;
    if (!type.startsWith(FILETREE_PREFIX)) return;

    // Looks like it, let's get it processed.
    type = type.replace(FILETREE_PREFIX, ``);
    const handlerName = `on${type}`;
    const handler = otHandler[handlerName].bind(otHandler);
    if (!handler) {
      return console.warn(`Missing implementation for ${handlerName}.`);
    }

    // TODO: what do we do if the container's been put to sleep?

    console.log(`processing ${type} message`);
    handler(detail, request);
  });
}

// ============================================================================

const seqnums = {};
const changelog = {};
const handlers = {};
const projects = {};

/**
 * Ensure we're aware of this path
 */
function init(basePath) {
  if (seqnums[basePath]) return;
  handlers[basePath] ??= new Set();
  changelog[basePath] = [];
  seqnums[basePath] = 1;
  projects[basePath] = getProject(basePath);
}

/**
 * Add a handler for events relating to
 * a specific folder's content.
 */
function addHandler(otHandler) {
  const { basePath } = otHandler;
  init(basePath);
  handlers[basePath].add(otHandler);
}

/**
 * Do the obvious thing
 */
function removeHandler(otHandler) {
  handlers[otHandler.basePath].delete(otHandler);
}

/**
 * Save an action to the list of transformations
 * that have been applied to this folder's content
 * since we started "looking" at it.
 *
 * Each action tracks who initiated it, when the
 * server received it, and which operation in the
 * sequence of transformations this is, so that
 * clients can tell whether or not they missed
 * any operations (and if so, request a full
 * sync via the file-tree:read operations).
 */
function addAction({ basePath, id }, action) {
  action.from = id;
  action.when = Date.now();
  action.seqnum = seqnums[basePath]++;
  changelog[basePath].push(action);
  broadcast(basePath, action);
}

/**
 * Broadcast an action to all listeners,
 * including the sender, so that they know
 * that the server processed it.
 */
async function broadcast(basePath, action) {
  handlers[basePath].forEach((handler) => {
    if (handler.unreliable) return;
    const { action: type, ...detail } = action;
    // console.log(`broadcasting [${basePath}]:[${detail.seqnum}]`)
    handler.send(type, detail);
  });
}

// ============================================================================

/**
 * An "operational transform" handler for file system operations,
 * with a "change type agnostic" file content update handling
 * mechanism that signals content updates, but does not process
 * them itself, instead relying on the `updateHandler` function
 * provided as part of the constructor call.
 */
class OTHandler {
  constructor(socket, user) {
    Object.assign(this, {
      contentDir: CONTENT_DIR,
      id: randomUUID(),
      socket,
      updateHandler: DEFAULT_HANDLER,
      user,
      writeAccess: false,
    });
    if (!this.user) this.unload();
  }

  unload() {
    removeHandler(this);
    this.unreliable = true;
    this.socket.close();
    delete this.contentDir;
    delete this.basePath;
  }

  send(type, detail) {
    type = FILETREE_PREFIX + type;
    try {
      this.socket.send(JSON.stringify({ type, detail }));
    } catch (e) {
      // Well that's a problem...? Make sure we don't
      // try to use this handler anymore because the
      // odds of data integrity are basically zero now.
      this.unload();
    }
  }

  getFullPath(path) {
    if ([`..`, `:`].some((e) => path.includes(e))) return false;
    return join(this.contentDir, this.basePath, path);
  }

  // ==========================================================================

  async onkeepalive({ basePath }) {
    // make sure the container doesn't go to sleep for
    // as long as people are editing their projects.
    touch(projects[basePath]);
  }

  async onload({ basePath, reconnect }) {
    const { user, id } = this;
    this.basePath = basePath;
    // does this user have write-access to this project?
    this.writeAccess = hasAccessToProject(user, basePath);
    addHandler(this);
    const { dirs, files } = readContentDir(join(CONTENT_DIR, basePath));
    const seqnum = seqnums[basePath] - 1;
    this.send(`load`, { id, dirs, files, seqnum, reconnect });
  }

  async onsync({ seqnum }) {
    if (seqnum > seqnums[this.basePath]) {
      // this shouldn't be possible. Whatever this client
      // is doing, it needs to stop and reconnect.
      this.send(`terminate`, { reconnect: true });
      this.unload();
    }

    // build the list of "messages missed":
    const actions = changelog[this.basePath]
      .filter((a) => a.seqnum > seqnum)
      .sort((a, b) => a.seqnum - b.seqnum);

    // Then send those at 15ms intervals so the (hopefully!)
    // arrive in sequence with plenty of time to process them.
    for (const { type, detail } of actions) {
      this.send(type, detail);
      await new Promise((resolve) => resolve, 15);
    }
  }

  // ==========================================================================

  async oncreate({ path, isFile, content = `` }) {
    if (!this.writeAccess) return;
    // console.log(`on create in ${this.basePath}:`, { path, isFile, content });
    const fullPath = this.getFullPath(path);
    if (!fullPath) return;
    if (isFile) {
      if (content?.map) content = Buffer.from(content);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, content);
    } else {
      mkdirSync(fullPath, { recursive: true });
    }
    addAction(this, { action: `create`, path, isFile, content });
  }

  async onmove({ isFile, oldPath, newPath }) {
    if (!this.writeAccess) return;
    // console.log(`on move in ${this.basePath}:`, { oldPath, newPath });
    const fullOldPath = this.getFullPath(oldPath);
    if (!fullOldPath) return;
    const fullNewPath = this.getFullPath(newPath);
    if (!fullNewPath) return;
    renameSync(fullOldPath, fullNewPath);
    addAction(this, { action: `move`, isFile, oldPath, newPath });
  }

  async onupdate({ path, type, update }) {
    if (!this.writeAccess) return;
    // console.log(`on update in ${this.basePath}:`, { path, update });
    const fullPath = this.getFullPath(path);
    if (!fullPath) return;
    // pass this update on to the update handler function
    this.updateHandler(fullPath, type, update);
    addAction(this, { action: `update`, type, path, update });
  }

  async ondelete({ path }) {
    if (!this.writeAccess) return;
    // console.log(`on delete in ${this.basePath}:`, { path });
    const fullPath = this.getFullPath(path);
    if (!fullPath) return;
    console.log(`removing:`, fullPath);
    rmSync(fullPath, { recursive: true, force: true });
    addAction(this, { action: `delete`, path });
  }

  // This is not a transform, and so does not require
  // recording or broadcasting to other subscribers.
  async onread({ path }) {
    // console.log(`on read`, { path });
    const fullPath = this.getFullPath(path);
    if (!fullPath) return;
    const data = Array.from(readFileSync(fullPath));
    this.send(`read`, { path, data });
  }
}
