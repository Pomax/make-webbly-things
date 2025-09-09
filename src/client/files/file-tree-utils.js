import { API } from "../utils/api.js";
import { getMimeType } from "./content-types.js";
import { updatePreview } from "../preview/preview.js";
import { getOrCreateFileEditTab } from "../editor/editor-components.js";
import { DEFAULT_FILES } from "./default-files.js";

import { unzip } from "/vendor/unzipit.module.js";

const { projectSlug, defaultFile, defaultCollapse } = document.body.dataset;

const fileTree = document.getElementById(`filetree`);

/**
 * When the file tree is ready, make sure to collapse anything
 * that's beeen marked as auto-collapse as part of the project
 * requirements.
 */
fileTree.addEventListener(`tree:ready`, async () => {
  let fileEntry;

  if (defaultFile) {
    fileEntry = fileTree.querySelector(`file-entry[path="${defaultFile}"]`);
  } else {
    for (const d of DEFAULT_FILES) {
      fileEntry = fileTree.querySelector(`file-entry[path="${d}"]`);
      if (fileEntry) break;
    }
  }

  if (fileEntry) {
    getOrCreateFileEditTab(
      fileEntry,
      projectSlug,
      fileEntry.getAttribute(`path`),
    );
  }

  if (defaultCollapse.trim()) {
    const entries = defaultCollapse
      .split(`\n`)
      .map((v) => v.trim())
      .filter(Boolean);
    entries.forEach((path) => {
      let entry = fileTree.querySelector(`dir-entry[path="${path}/"]`);
      entry?.toggle(true);
    });
  }
});

/**
 * Make sure we're in sync with the server...
 */
export async function setupFileTree() {
  const dirData = await API.files.dir(projectSlug);
  if (dirData instanceof Error) return;
  fileTree.setContent(dirData);
  addFileTreeHandling();
}

/**
 * Deal with all the events that might be coming from the file tree
 */
function addFileTreeHandling() {
  function updateEditorBindings(fileTreeEntry, entry, key, oldKey) {
    if (oldKey) {
      fileTreeEntry.state = {};
    }

    const { tab, panel } = entry;
    entry.filename = key;
    if (tab) {
      tab.title = key;
      tab.childNodes.forEach((n) => {
        if (n.nodeName === `#text`) {
          n.textContent = key;
        }
      });
    }
    if (panel) {
      panel.title = panel.id = key;
    }

    fileTreeEntry.setState(entry);
  }

  fileTree.addEventListener(`file:click`, async (evt) => {
    const fileEntry = evt.detail.grant();
    getOrCreateFileEditTab(
      fileEntry,
      projectSlug,
      fileEntry.getAttribute(`path`),
    );
    // note: we handle "selection" in the file tree as part of editor
    // reveals, so we do not call the event's own grant() function.
  });

  fileTree.addEventListener(`dir:click`, async (evt) => {
    evt.detail.grant();
  });

  fileTree.addEventListener(`dir:toggle`, async (evt) => {
    evt.detail.grant();
  });

  fileTree.addEventListener(`file:create`, async (evt) => {
    const { path, grant, content } = evt.detail;

    // file upload/drop
    if (content) {
      if (path.endsWith(`.zip`) && confirm(`Unpack zip file?`)) {
        const basePath = path.substring(0, path.lastIndexOf(`/`) + 1);
        const { entries } = await unzip(new Uint8Array(content).buffer);
        for await (let [path, entry] of Object.entries(entries)) {
          const arrayBuffer = await entry.arrayBuffer();
          const content = new TextDecoder().decode(arrayBuffer);
          if (content.trim()) {
            path = basePath + path;
            uploadFile(path, content, () => fileTree.addEntry(path));
          }
        }
      } else {
        uploadFile(path, content, grant);
      }
      updatePreview();
    }

    // regular file creation
    else {
      const response = await API.files.create(projectSlug, path);
      if (response instanceof Error) return;
      if (response.status === 200) {
        const fileEntry = grant();
        getOrCreateFileEditTab(fileEntry, projectSlug, path);
      } else {
        console.error(`Could not create ${path} (status:${response.status})`);
      }
    }
  });

  fileTree.addEventListener(`file:rename`, async (evt) => {
    const { oldPath, newPath, grant } = evt.detail;
    const response = await API.files.rename(projectSlug, oldPath, newPath);
    if (response instanceof Error) return;
    if (response.status === 200) {
      const fileEntry = grant();
      let key = oldPath.replace(projectSlug, ``);
      const entry = fileEntry.state;
      if (entry) {
        const newKey = newPath.replace(projectSlug, ``);
        updateEditorBindings(fileEntry, entry, newKey, key);
      }
    } else {
      console.error(
        `Could not rename ${oldPath} to ${newPath} (status:${response.status})`,
      );
    }
    updatePreview();
  });

  async function uploadFile(fileName, content, grant) {
    const fileSize = content.byteLength;
    if (fileSize > 10_000_000) {
      return alert(`File uploads are limited to 1MB`);
    }
    const form = new FormData();
    form.append(`filename`, fileName);
    form.append(
      `content`,
      typeof content === "string"
        ? content
        : new Blob([content], { type: getMimeType(fileName) }),
    );
    const response = await API.files.upload(projectSlug, fileName, form);
    if (response instanceof Error) return;
    if (response.status === 200) {
      grant?.();
    } else {
      console.error(`Could not upload ${fileName} (status:${response.status})`);
    }
  }

  fileTree.addEventListener(`file:move`, async (evt) => {
    const { oldPath, newPath, grant } = evt.detail;
    const response = await API.files.rename(projectSlug, oldPath, newPath);
    if (response instanceof Error) return;
    if (response.status === 200) {
      const fileEntry = grant();
      let key = oldPath.replace(projectSlug, ``);
      const entry = fileEntry.state;
      if (entry) {
        const newKey = newPath.replace(projectSlug, ``);
        updateEditorBindings(fileEntry, entry, newKey, key);
      }
    } else {
      console.error(
        `Could not move ${oldPath} to ${newPath} (status:${response.status})`,
      );
    }
    updatePreview();
  });

  fileTree.addEventListener(`file:delete`, async (evt) => {
    const { path, grant } = evt.detail;
    if (path) {
      try {
        const response = await API.files.delete(projectSlug, path);
        if (response instanceof Error) return;
        if (response.status === 200) {
          const [fileEntry] = grant();
          const { tab, panel } = fileEntry.state ?? {};
          tab?.remove();
          panel?.remove();
        } else {
          console.error(`Could not delete ${path} (status:${response.status})`);
        }
      } catch (e) {
        console.error(e);
      }
    }
    updatePreview();
  });

  fileTree.addEventListener(`dir:create`, async (evt) => {
    const { path, grant } = evt.detail;
    const response = await API.files.create(projectSlug, path);
    if (response instanceof Error) return;
    if (response.status === 200) {
      grant();
    } else {
      console.error(`Could not create ${path} (status:${response.status})`);
    }
  });

  fileTree.addEventListener(`dir:rename`, async (evt) => {
    const { oldPath, newPath, grant } = evt.detail;
    const response = await API.files.rename(projectSlug, oldPath, newPath);
    if (response instanceof Error) return;
    if (response.status === 200) {
      grant();
    } else {
      console.error(
        `Could not rename ${oldPath} to ${newPath} (status:${response.status})`,
      );
    }
    updatePreview();
  });

  fileTree.addEventListener(`dir:move`, async (evt) => {
    const { oldPath, newPath, grant } = evt.detail;
    const response = await API.files.rename(projectSlug, oldPath, newPath);
    if (response instanceof Error) return;
    if (response.status === 200) {
      grant();
    } else {
      console.error(
        `Could not move ${oldPath} to ${newPath} (status:${response.status})`,
      );
    }
    updatePreview();
  });

  fileTree.addEventListener(`dir:delete`, async (evt) => {
    const { path, grant } = evt.detail;
    const response = await API.files.delete(projectSlug, path);
    if (response instanceof Error) return;
    if (response.status === 200) {
      grant();
    } else {
      console.error(`Could not delete ${path} (status:${response.status})`);
    }
    updatePreview();
  });
}
