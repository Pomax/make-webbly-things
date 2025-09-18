import { API } from "../utils/api.js";
import { getMimeType } from "./content-types.js";
import { updatePreview } from "../preview/preview.js";
import { getOrCreateFileEditTab } from "../editor/editor-components.js";
import { DEFAULT_FILES } from "./default-files.js";

import { unzip } from "/vendor/unzipit.module.js";

const { defaultCollapse, defaultFile, projectMember, projectSlug } =
  document.body.dataset;

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
  // Only folks with edit rights get a websocket connection:
  if (!projectMember) {
    fileTree.setContent(dirData);
  } else {
    fileTree.connectViaWebSocket(`wss://${location.host}`, projectSlug);
  }
  addFileTreeHandling();
}

/**
 * ...
 */
async function uploadFile(fileTree, fileName, content, grant) {
  const fileSize = content.byteLength;

  if (fileSize > 10_000_000) {
    return alert(`File uploads are limited to 10 MB`);
  }

  if (fileTree.OT) {
    return grant(Array.from(new Uint8Array(content)));
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

/**
 * Deal with all the events that might be coming from the file tree
 */
function addFileTreeHandling() {
  function updateEditorBindings(fileTreeEntry) {
    const { path, state: entry } = fileTreeEntry;
    if (!entry) return;

    let key = path;
    if (key.includes(`/`)) {
      key = key.substring(key.lastIndexOf(`/`) + 1);
    }

    const { tab, panel } = entry;
    if (tab) {
      tab.title = key;
      tab.childNodes.forEach((n) => {
        if (n.nodeName === `#text`) {
          n.textContent = key;
        }
      });
    }
    if (panel) {
      panel.title = panel.id = path;
    }

    fileTreeEntry.setState(entry);
  }

  // TODO: refactor this as a set of functions rather than one giant list

  // ==================
  //   file click
  // ==================

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

  // ==================
  //   file create
  // ==================

  fileTree.addEventListener(`file:create`, async (evt) => {
    const { path, grant, content } = evt.detail;

    // file upload/drop
    if (content) {
      // Bulk upload
      if (path.endsWith(`.zip`) && confirm(`Unpack zip file?`)) {
        const basePath = path.substring(0, path.lastIndexOf(`/`) + 1);
        let { entries } = await unzip(new Uint8Array(content).buffer);

        entries = Object.entries(entries).map(([path, entry]) => ({
          path,
          entry,
        }));

        // Is this a "single dir that houses the actual content" zip?
        const prefix = (function findPrefix() {
          let a = entries[0].path;
          if (!a.includes(`/`)) return;
          a = a.substring(0, a.indexOf(`/`) + 1);
          if (entries.every((e) => e.path.startsWith(a))) return a;
        })();

        if (
          prefix &&
          confirm(
            `Unpack into the root, rather than "${prefix.substring(0, prefix.length - 1)}"?`,
          )
        ) {
          entries.forEach((e) => (e.path = e.path.replace(prefix, ``)));
        }

        for await (let { path, entry } of entries) {
          const arrayBuffer = await entry.arrayBuffer();
          const content = new TextDecoder().decode(arrayBuffer);
          if (content.trim()) {
            path = basePath + path;
            uploadFile(fileTree, path, content, () => {
              fileTree.createEntry(path, true, content);
            });
          }
        }
      }

      // Single file upload
      else {
        const entry = await uploadFile(fileTree, path, content, grant);
        getOrCreateFileEditTab(entry, projectSlug, path);
      }

      updatePreview();
    }

    // regular file creation
    else {
      const runCreate = () => {
        const fileEntry = grant();
        getOrCreateFileEditTab(fileEntry, projectSlug, path);
      };

      if (fileTree.OT) return runCreate();

      const response = await API.files.create(projectSlug, path);
      if (response instanceof Error) return;
      if (response.status === 200) {
        runCreate();
      } else {
        console.error(`Could not create ${path} (status:${response.status})`);
      }
    }
  });

  fileTree.addEventListener(`ot:created`, (evt) => {
    // We don't actually want to do anything
    // beyond "add the file tree entry"
  });

  // ==================
  //  file rename/move
  // ==================

  const renameHandler = async (evt) => {
    const { oldPath, newPath, grant } = evt.detail;

    const runMove = () => {
      const fileEntry = grant();
      updateEditorBindings(fileEntry);
    };

    if (fileTree.OT) {
      return runMove();
    }

    const response = await API.files.rename(projectSlug, oldPath, newPath);
    if (response instanceof Error) return;
    if (response.status === 200) {
      runMove();
    } else {
      console.error(
        `Could not move ${oldPath} to ${newPath} (status:${response.status})`,
      );
    }
    updatePreview();
  };

  // rename is really just a move, but in terms of user experience
  // it's a different action, so there are two events for it.
  fileTree.addEventListener(`file:rename`, renameHandler);
  fileTree.addEventListener(`file:move`, renameHandler);

  // When OT applies it, though, there is no user interaction:
  // both rename and move operations are just "ot:moved".
  fileTree.addEventListener(`ot:moved`, async (evt) => {
    updateEditorBindings(evt.detail.entry);
  });

  // ==================
  //    file delete
  // ==================

  fileTree.addEventListener(`file:delete`, async (evt) => {
    const { path, grant } = evt.detail;

    const runDelete = () => {
      const [entry] = grant();
      const { close } = entry.state ?? {};
      console.log(close);
      close?.click();
    };

    if (fileTree.OT) {
      return runDelete();
    }

    if (path) {
      try {
        const response = await API.files.delete(projectSlug, path);
        if (response instanceof Error) return;
        if (response.status === 200) {
          runDelete();
        } else {
          console.error(`Could not delete ${path} (status:${response.status})`);
        }
      } catch (e) {
        console.error(e);
      }
    }
    updatePreview();
  });

  fileTree.addEventListener(`ot:deleted`, async (evt) => {
    const { entries } = evt.detail;
    const [fileEntry] = entries;
    const { close } = fileEntry.state ?? {};
    close?.click();
  });

  // ==================
  //   dir click
  // ==================

  fileTree.addEventListener(`dir:click`, async (evt) => {
    evt.detail.grant();
  });

  // ==================
  //   dir toggle
  // ==================

  fileTree.addEventListener(`dir:toggle`, async (evt) => {
    evt.detail.grant();
  });

  // ==================
  //    dir create
  // ==================

  fileTree.addEventListener(`dir:create`, async (evt) => {
    const { path, grant } = evt.detail;
    if (fileTree.OT) return grant();

    const response = await API.files.create(projectSlug, path);
    if (response instanceof Error) return;
    if (response.status === 200) {
      grant();
    } else {
      console.error(`Could not create ${path} (status:${response.status})`);
    }
  });

  // ==================
  //   dir rename/move
  // ==================

  const dirRenameHandler = async (evt) => {
    const { oldPath, newPath, grant } = evt.detail;
    if (fileTree.OT) return grant();

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
  };

  fileTree.addEventListener(`dir:rename`, dirRenameHandler);
  fileTree.addEventListener(`dir:move`, dirRenameHandler);

  // ==================
  //     dir delete
  // ==================

  fileTree.addEventListener(`dir:delete`, async (evt) => {
    const { path, grant } = evt.detail;
    if (fileTree.OT) return grant();

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
