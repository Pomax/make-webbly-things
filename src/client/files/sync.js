import { createPatch } from "/vendor/diff.js";
import { fetchFileContents, getFileSum } from "../utils/utils.js";
import { updatePreview } from "../preview/preview.js";
import { API } from "../utils/api.js";

/**
 * Sync the content of a file with the server by calculating
 * the diffing patch, sending it over to the server so it can
 * apply it to the file on disk, and then verifying the change
 * made was correct by comparing the on-disk "hash" value with
 * the same value based on the current editor content.
 */
export async function syncContent(
  projectName,
  entry,
  filename = entry.filename,
) {
  if (entry.noSync) return;

  const currentContent = entry.content;
  const newContent = entry.view.state.doc.toString();
  const changes = createPatch(filename, currentContent, newContent);
  const response = await API.files.sync(projectName, filename, changes);
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
      entry.content = await fetchFileContents(projectName, filename);
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

  entry.debounce = false;
}
