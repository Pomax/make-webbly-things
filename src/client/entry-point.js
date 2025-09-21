import "/vendor/file-tree.esm.min.js";
import { setupFileTree } from "./files/file-tree-utils.js";
import { addEventHandling } from "./editor/event-handling.js";
import { updatePreview } from "./preview/preview.js";
import { Notice, Warning, ErrorNotice } from "./utils/notifications.js";

const { projectId, projectSlug } = document.body.dataset;

new (class Editor {
  constructor() {
    Object.assign(this, { projectId, projectSlug });
    this.init();
  }

  async init() {
    // CodeMirror 6 has no built in file browser, so we need to add one.
    await setupFileTree(this);
    // As such, we also need custom handling for editor panes and tabs
    addEventHandling(this.projectSlug);
    updatePreview();
    // FIXME: TODO: just move this stuff here. https://github.com/Pomax/make-webbly-things/issues/101
    new Notice(`Something has gone very wrong...`)
  }
})();

// TODO: move the event handling into the class itself?
