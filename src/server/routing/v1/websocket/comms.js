import { scrubDateTime } from "../../../../helpers.js";
import { getProject, touch } from "../../../database/index.js";

/**
 * A general "comms" handling class that takes care of
 * pub/sub, broadcasting, per-project sequence numbers,
 * etc. etc.
 */
class Comms {
  #seqnums = {};
  #changelog = {};
  #handlers = {};
  #projects = {};

  /**
   * Add a handler for events relating to
   * a specific folder's content.
   */
  addHandler(otHandler) {
    const { basePath } = otHandler;
    this.#init(basePath);
    this.#handlers[basePath].add(otHandler);
  }

  /**
   * Ensure everything is set up for this
   * particular path monitor,
   */
  #init(basePath) {
    if (this.#seqnums[basePath]) return;
    this.#seqnums[basePath] = 1;
    this.#changelog[basePath] = [];
    this.#handlers[basePath] ??= new Set();
    this.#projects[basePath] = getProject(basePath);
  }

  /**
   * Do the obvious thing:
   */
  removeHandler(otHandler) {
    this.#handlers[otHandler.basePath].delete(otHandler);
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
  addAction({ basePath, id }, action) {
    action.from = id;
    action.when = Date.now();
    action.seqnum = this.#seqnums[basePath]++;
    this.#changelog[basePath].push(action);
    this.#broadcast(basePath, action);
  }

  /**
   * Get all basepath-related actions that are
   * newer than some giving "last known good"
   * sequence number.
   */
  getActions(basePath, lastKnownGood) {
    return this.#changelog[basePath]
      .filter((a) => a.seqnum > lastKnownGood)
      .sort((a, b) => a.seqnum - b.seqnum);
  }

  /**
   * Get the current sequence number associated
   * with a specific project's base path.
   */
  getSeqNum(basePath) {
    return this.#seqnums[basePath];
  }

  /**
   * Broadcast an action to all listeners,
   * including the sender, so that they know
   * that the server processed it.
   */
  async #broadcast(basePath, action) {
    this.#handlers[basePath].forEach((handler) => {
      if (handler.unreliable) return;
      const { action: type, ...detail } = action;
      // console.log(`broadcasting [${basePath}]:[${detail.seqnum}]`)
      handler.send(type, detail);
    });
  }

  /**
   * wrapper call to the project.touch function to
   * make sure that a project's "updated_at" stays
   * recent enough to not stop the docker container.
   */
  touch(basePath) {
    const time = scrubDateTime(new Date().toISOString());
    console.log(`TOUCH [${time}] ${basePath}`);
    touch(this.#projects[basePath]);
  }
}

export const comms = new Comms();
