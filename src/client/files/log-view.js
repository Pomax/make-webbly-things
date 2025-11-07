import {
  SERVER_LOG_TAB_NAME,
  updateViewMaintainScroll,
} from "../utils/utils.js";
import { getOrCreateFileEditTab } from "./editor-entry.js";

// TODO: websockets when available'

export class LogView {
  open = false;
  virtual = true;
  pollingInterval = 5000;

  constructor(button) {
    this.button = button;

    // FIXME: we should be able to just create a <file-entry>,
    //        but this is throwing errors in custom-file-tree atm.
    const fileEntry = (this.fileEntry = {
      root: {},
      path: SERVER_LOG_TAB_NAME,
      state: {},
      setState: (o) => Object.assign(fileEntry.state, o),
      select: () => {},
      addEventListener: () => {},
      onUnload: () => this.close(),
    });
  }

  close() {
    this.poll = clearInterval(this.poll);
    this.open = false;
    this.button.disabled = false;
    this.update(``);
  }

  toggle(state = !this.open) {
    this.open = state;
    if (state) {
      this.button.disabled = true;
      this.editor = getOrCreateFileEditTab(this.fileEntry, this.virtual);
      this.update(`Loading...`);
      let since = 0;
      const pollData = async () => {
        try {
          if (!this.open) throw `close`;
          const data = await fetch(
            `/v1/projects/logs/${projectSlug}/${since}`,
          ).then((r) => r.json());
          const { output, datetime } = data || {};
          since = datetime;
          this.append(output);
        } catch {
          this.close();
        }
      };
      this.poll = setInterval(pollData, this.pollingInterval);
      pollData();
    } else {
      this.close();
    }
  }

  append(text, reset = false) {
    this.update(reset ? text : this.editor.content + text);
  }

  update(content) {
    const editorEntry = this.editor;
    editorEntry.setContent(content);
    updateViewMaintainScroll(editorEntry);
  }
}
