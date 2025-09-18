import { createPatch, applyPatch } from "/vendor/diff.js";
import { fetchFileContents, getFileSum } from "../utils/utils.js";
import { updatePreview } from "../preview/preview.js";
import { API } from "../utils/api.js";

export function createUpdateListener(entry) {
  const { view } = entry;

  return async (evt) => {
    const { type, update, ours } = evt.detail;
    console.log(`received:`, { type, update, ours });
    if (type === `diff`) {
      if (!ours) {
        const oldContent = entry.content;
        const newContent = applyPatch(oldContent, update);

        entry.scrollPosition = view.dom.querySelector(`.cm-scroller`).scrollTop;
        console.log(entry.scrollPosition);
        
        entry.content = newContent;
        entry.contentReset = true;
        view.dispatch({
          changes: {
            from: 0,
            to: oldContent.length,
            insert: entry.content,
          },
        });

        // TODO: ideally we can preserve scroll position??
      }
      updatePreview();
    }
  };
}

/**
 * Sync the content of a file with the server by calculating
 * the diffing patch, sending it over to the server so it can
 * apply it to the file on disk, and then verifying the change
 * made was correct by comparing the on-disk "hash" value with
 * the same value based on the current editor content.
 */
export async function syncContent(
  projectSlug,
  fileEntry,
  filename = fileEntry.state.filename
) {
  const entry = fileEntry.state;
  if (entry.noSync) return;

  const currentContent = entry.content;
  const newContent = entry.view.state.doc.toString();
  const patch = createPatch(filename, currentContent, newContent);

  // sync via websocket or REST?
  if (fileEntry.root.OT) {
    entry.content = newContent;
    fileEntry.updateContent(`diff`, patch);
  }

  // REST updates require a lot more work.
  else {
    const response = await API.files.sync(projectSlug, filename, patch);
    const responseHash = parseFloat(await response.text());
    if (responseHash === getFileSum(newContent)) {
      entry.content = newContent;
      updatePreview();
    } else {
      // If we get here, then something went wrong.
      //
      // This could be an illegal edit by someone who doesn't have project
      // edit rights (non-project-members should already be presented with
      // a read-only editor, so this would be a circumvention attempt).
      //
      // Or, much more likely, the user's content has become desynced
      // somehow and we resync it.
      if (document.body.dataset.projectMember) {
        entry.content = await fetchFileContents(projectSlug, filename);
      }

      entry.contentReset = true;
      entry.view.dispatch({
        changes: {
          from: 0,
          to: entry.view.state.doc.length,
          insert: entry.content,
        },
      });
    }
  }

  // finally, clear the debounc flag because we just sent off
  // all the accumulated data we had pending transmission.
  entry.debounce = false;
}
