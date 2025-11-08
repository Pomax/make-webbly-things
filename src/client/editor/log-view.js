import {
  SERVER_LOG_TAB_NAME,
  appendViewContent,
  updateViewMaintainScroll,
} from "../utils/utils.js";
import { getOrCreateFileEditTab } from "./editor-entry.js";

const { projectSlug } = document.body.dataset;

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
    this.setContent(``);
  }

  setContent(content) {
    const editorEntry = this.editor;
    editorEntry.setContent(content);
    updateViewMaintainScroll(editorEntry);
  }

  toggle(state = !this.open) {
    this.open = state;
    if (state) {
      this.button.disabled = true;
      this.editor = getOrCreateFileEditTab(this.fileEntry, this.virtual);
      this.setContent(`Loading...`);
      let since = 0;
      const pollData = async () => {
        try {
          if (!this.open) throw `close`;
          const url = `/v1/projects/logs/${projectSlug}/${since}`;
          const data = await fetch(url).then((r) => r.json());
          const { output, datetime } = data || {};
          if ((output ?? ``).trim?.()) {
            since = new Date(Date.parse(datetime) + 10).toISOString();
            this.append(output);
          }
        } catch (e) {
          console.error(e);
          this.close();
        }
      };
      this.poll = setInterval(pollData, this.pollingInterval);
      pollData();
    } else {
      this.close();
    }
  }

  append(text) {
    if (!text) return;
    const editorEntry = this.editor;
    const content = editorEntry.content + text;
    editorEntry.setContent(content);
    appendViewContent(editorEntry, text);
  }
}
