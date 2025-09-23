import { createPatch, applyPatch } from "/vendor/diff.js";
import { fetchFileContents, getFileSum } from "../utils/utils.js";
import { updatePreview } from "../preview/preview.js";
import { API } from "../utils/api.js";

export function createUpdateListener(entry) {
  const { view } = entry;

  return async (evt) => {
    const { type, update, ours } = evt.detail;
    if (type === `diff`) {
      if (!ours) {
        const oldContent = entry.content;
        const newContent = applyPatch(oldContent, update);

        // FIXME: this is not the only place we set the scrollpostion followed
        //        by a view update dispatch, so we probably want to unify that.
        //        Search for RPL1423 to find the other spot(s) we do this.
        entry.scrollPosition = view.dom.querySelector(`.cm-scroller`).scrollTop;
        entry.content = newContent;
        entry.contentReset = true;
        view.dispatch({
          changes: {
            from: 0,
            to: oldContent.length,
            insert: entry.content,
          },
        });

        // TODO: ideally we can preserve scroll position cleanly? https://github.com/Pomax/make-webbly-things/issues/105
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
export async function syncContent(projectSlug, fileEntry) {
  // No syncing if we're in rewind mode:
  const history = document.querySelector(`div.history`);
  if (history) return;

  const { path } = fileEntry;
  const entry = fileEntry.state;
  if (entry.noSync) return;

  // Do we even have something to sync, here?
  const currentContent = entry.content;
  const newContent = entry.view.state.doc.toString();
  if (newContent === currentContent) return;

  // We do!
  const patch = createPatch(path, currentContent, newContent);

  // sync via websocket or REST?
  if (fileEntry.root.OT) {
    entry.content = newContent;
    fileEntry.updateContent(`diff`, patch);
  }

  // REST updates require a lot more work.
  else {
    const response = await API.files.sync(projectSlug, path, patch);
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
        entry.content = await fetchFileContents(projectSlug, path);
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
