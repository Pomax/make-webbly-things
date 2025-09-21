import { fetchFileContents } from "../utils/utils.js";
import { API } from "../utils/api.js";
import { Notice } from "../utils/notifications.js";

const mac = navigator.userAgent.includes(`Mac OS`);

// These always exist
const left = document.getElementById(`left`);
const right = document.getElementById(`right`);

// These may not always exist:
const download = document.getElementById(`download`);
const format = document.getElementById(`format`);

/**
 * Hook up the "Add new file" and "Format this file" buttons
 */
export function addEventHandling(projectSlug) {
  // disable the "Save page" shortcut because it's meaningless in this context.
  document.addEventListener(`keydown`, (evt) => {
    const { key, ctrlKey, metaKey } = evt;
    if (key === `s`) {
      if ((mac && metaKey) || ctrlKey) {
        evt.preventDefault();
        new Notice(`Your files are auto-saved =)`, 2000);
      }
    }
  });

  download?.addEventListener(`click`, async () => {
    API.projects.download(projectSlug);
  });

  format?.addEventListener(`click`, async () => {
    const tab = document.querySelector(`.active`);
    const fileEntry = document.querySelector(`file-entry.selected`);
    if (fileEntry.state?.tab !== tab) {
      throw new Error(`active tab has no associated selected file? O_o`);
    }
    const fileName = fileEntry.path;
    format.hidden = true;
    const result = await API.files.format(projectSlug, fileName);
    if (result instanceof Error) return;
    format.hidden = false;
    const { view } = fileEntry.state;
    const content = await fetchFileContents(projectSlug, fileName);
    fileEntry.setState({ content });
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: content,
      },
    });
  });

  addTabScrollHandling();
}

/**
 * Basic tab scrolling: click/touch-and-hold
 */
function addTabScrollHandling() {
  let scrolling = false;

  function scrollTabs(step) {
    if (!scrolling) return;
    tabs.scrollBy(step, 0);
    setTimeout(() => scrollTabs(step), 4);
  }

  for (const type of [`mouseup`, `touchend`]) {
    document.addEventListener(type, () => (scrolling = false));
  }

  for (const type of [`mouseout`, `touchend`]) {
    left.addEventListener(type, () => (scrolling = false));
    right.addEventListener(type, () => (scrolling = false));
  }

  for (const type of [`mousedown`, `touchstart`]) {
    left.addEventListener(type, () => {
      scrolling = true;
      scrollTabs(-2);
    });
    right.addEventListener(type, () => {
      scrolling = true;
      scrollTabs(2);
    });
  }
}
