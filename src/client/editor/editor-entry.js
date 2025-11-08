import { API } from "../utils/api.js";
import { setupView } from "./code-mirror-6.js";
import {
  SERVER_LOG_TAB_NAME,
  fetchFileContents,
  create,
} from "../utils/utils.js";
import { getViewType, verifyViewType } from "../files/content-types.js";
import { syncContent } from "../files/sync.js";
import { ErrorNotice, Notice } from "../utils/notifications.js";
import { Rewinder } from "../files/rewind.js";
import { handleFileHistory } from "../files/websocket-interface.js";
import { ensureFileTreeWidth } from "../files/file-tree-utils.js";
import { updatePreview } from "../preview/preview.js";

const { projectSlug, useWebsockets } = document.body.dataset;
const fileTree = document.querySelector(`file-tree`);
const tabs = document.getElementById(`tabs`);
const editors = document.getElementById(`editors`);

let movingTab;
const emptyImage = new Image();
emptyImage.src = `data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=`;

// Drop-in replacement for editor-components.js:getOrCreateFileEditTab
export function getOrCreateFileEditTab(fileEntry, virtual = false) {
  return EditorEntry.getOrCreateFileEditTab(fileEntry, virtual);
}

export class EditorEntry {
  // Static properties and methods

  static entries = [];

  static addEntry(entry) {
    EditorEntry.entries.push(entry);
  }

  static removeEntry(entry) {
    const pos = EditorEntry.entries.indexOf(entry);
    EditorEntry.entries.splice(pos, 1);
  }

  static getEntries() {
    return EditorEntry.entries;
  }

  static getNext(reference) {
    const { entries } = EditorEntry;
    const pos = entries.indexOf(reference);
    if (pos === entries.length - 1) return entries.at(pos - 1);
    return entries.at(pos + 1);
  }

  static getOrCreateFileEditTab(fileEntry, virtual = false) {
    const entry = EditorEntry.entries.find((e) => e.fileEntry === fileEntry);
    if (entry) return entry.select();
    return new EditorEntry(fileEntry, virtual);
  }

  static sortFromTabs() {
    const { entries } = EditorEntry;
    const ordering = [...tabs.querySelectorAll(`.editor.tab`)];
    entries.sort((a, b) => {
      a = ordering.indexOf(a.tab);
      b = ordering.indexOf(b.tab);
      return a === b ? 0 : a < b ? -1 : 1;
    });
  }

  // Instance properties and methods

  editable = false;
  contentReset = false;
  debounce = false;

  setEditable = () => {}; // Relies on the function binding performed in getInitialState()

  constructor(fileEntry, virtual = false) {
    this.fileEntry = fileEntry;
    this.virtual = virtual;
    EditorEntry.entries.push(this);
    fileEntry.setState({ editorEntry: this });
    this.select();
  }

  async select() {
    if (!this.editor) await this.load();
    this.focus();
    return this;
  }

  async getFileData(path, mimetype) {
    const { fileEntry } = this;
    0;
    let data;
    if (fileEntry.root.OT) {
      ({ data } = await fileEntry.load());
    } else {
      try {
        data = await fetchFileContents(projectSlug, path, mimetype);
        if (data instanceof Error) data = undefined;
      } catch (e) {}
    }
    return data || new ErrorNotice(`Could not load ${path}`);
  }

  // FIXME: this function is too long to easily maintain.
  async load() {
    const { fileEntry, virtual } = this;
    const { path } = this.fileEntry;
    const filename = path.split(`/`).at(-1);

    const viewType = getViewType(filename);
    const { text, unknown, media, type } = viewType;

    let data = ``;
    if (!virtual) {
      data = await this.getFileData(path, type);
      if (data instanceof Notice) return data;

      const verified = verifyViewType(viewType.type, data);
      if (!verified) {
        return new ErrorNotice(
          `Content for ${path} does not match the file extension!`,
        );
      }
    }

    this.editable = viewType.editable;

    // set up our content panel, used to either slot in a codemirror, or media
    this.createEditorPanel(path);

    // Fill the editor panel: is this plain text?
    if (text || unknown) {
      this.setTextContent(data);
    }

    // Fill the editor panel: is this a media file?
    else if (media) {
      const key = `${projectSlug}/${path}`;
      this.setMediaContent(type, key);
    }

    // Finally, set up our file's "tab" in the "open files" list
    this.createTab(path, filename);

    // And on the event handling side, make sure we update on content updates.
    fileEntry.addEventListener(`content:update`, (evt) => this.update(evt));
  }

  createEditorPanel(path) {
    let classes = `editor panel`;
    if (path === SERVER_LOG_TAB_NAME) {
      classes += ` logs`;
    }
    const editor = (this.editor = create(`div`, { class: classes }));
    editors.appendChild(editor);
  }

  createTab(path, filename) {
    const tab = (this.tab = create(
      `div`,
      {
        class: `editor tab`,
        draggable: true,
        title: path,
        textContent: filename,
      },
      {
        click: () => this.focus(),
      },
    ));

    tab.addEventListener(`click`, async () => this.focus());

    tab.addEventListener(`dragstart`, (evt) => {
      movingTab = tab;
      tab.classList.add(`moving`);
      const { dataTransfer } = evt;
      // Such nonsense... This should have been
      // "arbitrary data" and "use CSS" from day 1:
      dataTransfer.setData(`text/plain`, ``);
      dataTransfer.setDragImage(emptyImage, 0, 0);
      dataTransfer.effectAllowed = `move`;
    });

    tab.addEventListener(`dragover`, (evt) => {
      const { target } = evt;
      const source = movingTab;
      if (source === target) return;
      if (!source.classList.contains(`tab`)) return;
      evt.preventDefault();
      if (target === source.previousSibling) {
        tabs.insertBefore(source, target);
      } else {
        tabs.insertBefore(source, target.nextSibling);
      }
    });

    tab.addEventListener(`dragend`, (evt) => {
      movingTab.classList.remove(`moving`);
      movingTab = undefined;
      EditorEntry.sortFromTabs();
    });

    // The server log gets to live on the left.
    if (path === SERVER_LOG_TAB_NAME) {
      const first = tabs.children[0];
      if (first) {
        tabs.insertBefore(tab, first);
      } else {
        tabs.appendChild(tab);
      }
    } else {
      tabs.appendChild(tab);
    }

    // set up the
    const close = (this.close = create(
      `button`,
      {
        textContent: `x`,
        class: `close`,
      },
      {
        click: () => this.unload(),
      },
    ));

    close.addEventListener(`pointerdown`, () => this.unload());
    close.addEventListener(`click`, () => this.unload());
    tab.appendChild(close);
  }

  setTextContent(data) {
    if (data.map) {
      data = new TextDecoder().decode(Uint8Array.from(data));
    }
    this.setContent(data);
    this.view = setupView(this, data);
  }

  setContent(content) {
    this.content = content;
  }

  setMediaContent(type, key) {
    let view;
    if (type.startsWith(`image`)) {
      view = create(`img`);
    } else if (type.startsWith(`audio`)) {
      view = create(`audio`);
      view.controls = true;
    } else if (type.startsWith(`video`)) {
      view = create(`video`);
      view.controls = true;
    }
    view.src = `/v1/files/content/${key}`;
    this.editor.appendChild(view);
  }

  async focus() {
    const { fileEntry, editor, tab, view } = this;
    fileEntry.select();
    ensureFileTreeWidth();

    EditorEntry.entries.forEach((e) => e.blur());
    editor.classList.add(`active`);
    tab.classList.add(`active`);
    tab.scrollIntoView();
    view?.focus();

    // For easy link sharing, update our visible URL to include the current file:
    const currentURL = location.toString().replace(location.search, ``);
    const viewURL = `${currentURL}?view=${fileEntry.path}`;
    history.replaceState(null, null, viewURL);

    // And finally, check to see if we're currently rewinding:
    if (Rewinder.active) {
      // TODO: DRY: can we unify this with file-tree-utils and event-handling
      if (useWebsockets) {
        fileTree.OT?.getFileHistory(fileEntry.path);
      } else {
        const history = await API.files.history(projectSlug, fileEntry.path);
        handleFileHistory(fileEntry, projectSlug, history);
      }
    }
  }

  blur() {
    const { tab, editor, view } = this;
    tab.classList.remove(`active`);
    editor.classList.remove(`active`);
  }

  unload() {
    const { fileEntry, tab, editor } = this;
    tabs.removeChild(tab);
    editors.removeChild(editor);
    // When we close the active tab, move focus to another tab, if there is one.
    if (tab.classList.contains(`active`)) {
      EditorEntry.getNext(this)?.select();
    }
    delete fileEntry.state.editorEntry;
    EditorEntry.removeEntry(this);
    fileEntry.onUnload?.();
  }

  async update(evt) {
    const { type, update, ours } = evt.detail;
    if (type !== `diff`) return;
    if (!ours) {
      const oldContent = entry.content;
      this.setContent(applyPatch(oldContent, update));
      updateViewMaintainScroll(this);
    }
    updatePreview();
  }

  sync() {
    const { fileEntry, editable } = this;
    if (!editable) return;
    if (this.virtual) return;
    syncContent(projectSlug, fileEntry);
  }

  lock() {
    if (!this.editable) return;
    this.editable = false;
    this.setEditable?.(false);
  }

  unlock() {
    if (this.editable) return;
    this.editable = true;
    this.setEditable?.(true);
  }
}
