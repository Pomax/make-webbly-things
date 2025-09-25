import { WebSocketInterface } from "custom-file-tree";
import { Rewinder } from "./rewind.js";

// Our websocket interface needs some functions that are not
// offered as part of the standard file tree ws interface:
export class CustomWebsocketInterface extends WebSocketInterface {
  constructor(...args) {
    super(...args);
    this.bypassSync.push(`filehistory`);
  }

  // We're adding some more functions!
  // notably: history traversal for files.

  async getFileHistory(path) {
    this.send(`filehistory`, { path });
  }

  async onfilehistory({ path, history }) {
    if (history.length === 0) return;
    const fileEntry = document.querySelector(`file-entry[path="${path}"]`);
    let { rewind } = fileEntry.state;
    if (!rewind) {
      rewind = new Rewinder(this.basePath, fileEntry);
      fileEntry.setState({ rewind });
    }
    rewind.setHistory(history);
    rewind.show();
  }
}
