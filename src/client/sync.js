import { fetchFileContents, getFileSum } from "./utils.js";
import { createPatch } from "../../public/vendor/diff.js";
import { updatePreview } from "../client/preview.js";
import { API } from "./api.js";

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
  filename = entry.filename
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
  }

  // If a user tries to change a file they don't have rights to, we nix their changes.
  else {
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
