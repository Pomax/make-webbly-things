import "/vendor/file-tree.esm.min.js";
import { setupFileTree } from "./files/file-tree-utils.js";
import { addEventHandling } from "./editor/event-handling.js";
import { updatePreview } from "./preview/preview.js";

const { projectId, projectName } = document.body.dataset;

new class Editor {
  constructor() {
    Object.assign(this, { projectId, projectName });
    this.init();
  }

  async init() {
    // CodeMirror 6 has no built in file browser, so we need to add one.
    await setupFileTree(this);
    // As such, we also need custom handling for editor panes and tabs
    addEventHandling(this.projectName);
    updatePreview();
  }
}