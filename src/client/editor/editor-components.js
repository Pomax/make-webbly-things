import { getInitialState, setupView } from "./code-mirror-6.js";
import { fetchFileContents, create } from "../utils/utils.js";
import { getViewType, verifyViewType } from "../files/content-types.js";
import { syncContent, createUpdateListener } from "../files/sync.js";

const { projectId } = document.body.dataset;

const fileTree = document.querySelector(`file-tree`);
const tabs = document.getElementById(`tabs`);
const editors = document.getElementById(`editors`);

// "edit" button for editing project settings
const settingsIcon = document.querySelector(`.project-settings`);
settingsIcon?.addEventListener(`click`, () => {
  showEditDialog(projectId);
});

/**
 * Create the editor's on-page container
 */
export function setupEditorPanel(filename) {
  const panel = create(`div`);
  panel.id = filename;
  panel.title = filename;
  panel.classList.add(`editor`, `tab`);
  return panel;
}

/**
 * Create an editor's associated "tab" in the tab row
 */
export function setupEditorTab(filename) {
  const tab = create(`div`);
  tab.title = filename;
  tab.textContent = filename.includes(`/`)
    ? filename.substring(filename.lastIndexOf(`/`) + 1)
    : filename;
  // TODO: make tabs draggable so users can reorder them. https://github.com/Pomax/make-webbly-things/issues/102
  document
    .querySelectorAll(`.active`)
    .forEach((e) => e.classList.remove(`active`));
  tab.classList.add(`tab`, `active`);

  const close = create(`button`);
  close.textContent = `x`;
  close.classList.add(`close`);
  tab.appendChild(close);

  return { tab, close };
}

/**
 * Add all the event handling we're using in this experiment:
 * tabs should trigger the editor they're associated with and mark themselves as active,
 * close buttons should remove the UI elements associated with an editor.
 * @param {*} filename
 * @param {*} panel
 * @param {*} tab
 * @param {*} close
 * @param {*} view
 */
export function addEditorEventHandling(fileEntry, panel, tab, close, view) {
  tab.addEventListener(`click`, () => {
    if (!fileEntry.state) return;
    if (!fileEntry.state.tab) return;
    if (!fileEntry.parentNode) return;
    fileEntry.select();
    document
      .querySelectorAll(`.editor`)
      .forEach((e) => e.setAttribute(`hidden`, `hidden`));
    panel.removeAttribute(`hidden`);
    document
      .querySelectorAll(`.active`)
      .forEach((e) => e.classList.remove(`active`));
    tab.classList.add(`active`);
    tab.scrollIntoView();
    view.focus();
    // update our visible URL too, so folks can link to files.
    const currentURL = location.toString().replace(location.search, ``);
    const viewURL = `${currentURL}?view=${fileEntry.path}`;
    history.replaceState(null, null, viewURL);
  });

  const closeTab = () => {
    if (fileEntry.state.closed) return;
    let newTab;
    if (tab.classList.contains(`active`)) {
      // move focus to another tab, if there is one...
      fileTree.unselect();
      const tabs = Array.from(document.querySelectorAll(`div.tab`));
      const tabPos = tabs.findIndex((t) => t === tab);
      newTab = tabPos === 0 ? tabs[1] : tabs[tabPos - 1];
    }
    fileEntry.state.closed = true;
    tab.remove();
    panel.remove();
    newTab?.click();
  };

  close.addEventListener(`pointerdown`, closeTab);
  close.addEventListener(`click`, closeTab);
}

/**
 * Create the collection of page UI elements and associated editor
 * component for a given file.
 */
export async function getOrCreateFileEditTab(fileEntry, projectSlug, filename) {
  let entry = fileEntry.state;

  if (entry?.view) {
    const { closed, tab, panel } = entry;
    if (closed) {
      entry.closed = false;
      tabs.appendChild(tab);
      editors.appendChild(panel);
    }
    return tab.click();
  }

  const panel = setupEditorPanel(filename);
  editors.appendChild(panel);

  const { tab, close } = setupEditorTab(filename);
  tabs.appendChild(tab);

  // Is this text or viewable media?
  const viewType = getViewType(filename);

  // Do we fetch it via websocket or REST?
  let data;
  if (fileEntry.root.OT) {
    ({ data } = await fileEntry.load());
  } else {
    data = await fetchFileContents(projectSlug, filename, viewType.type);
  }

  const verified = verifyViewType(viewType.type, data);
  if (!verified) return alert(`File contents does not match extension.`);

  const key = `${projectSlug}/${filename}`;

  let view;

  // Plain text?
  if (viewType.text || viewType.unknown) {
    if (data.map) {
      data = data.map((v) => String.fromCharCode(v)).join(``);
    }
    const initialState = getInitialState(fileEntry, filename, data);
    view = setupView(panel, initialState);
  }

  // Media file?
  else if (viewType.media) {
    const { type } = viewType;
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
    panel.appendChild(view);
  }

  // FIXME: this feels like a hack, but there doesn't appear to be
  //        a clean way to associate data with an editor such that
  //        the onChange handler can access the right key...
  //        https://github.com/Pomax/make-webbly-things/issues/110
  view.tabElement = tab;

  // Add tab and tab-close event hanlding:
  addEditorEventHandling(fileEntry, panel, tab, close, view);

  // Track this collection
  const properties = {
    filename,
    tab,
    close,
    panel,
    view,
    content: viewType.editable ? view.state.doc.toString() : data,
    sync: () => {
      if (viewType.editable) {
        syncContent(projectSlug, fileEntry);
      }
    },
    noSync: !viewType.editable,
  };

  if (entry) {
    Object.assign(entry, properties);
  } else {
    fileEntry.setState(properties);
    entry = fileEntry.state;
  }

  // Make sure we have a change listener in place
  // TODO: this feels like it should live in sync.js, not here. https://github.com/Pomax/make-webbly-things/issues/103
  if (!entry.updateListener) {
    const updateListener = createUpdateListener(entry);
    fileEntry.addEventListener(`content:update`, updateListener);
  }

  // And activate this editor
  tab.click();
}
