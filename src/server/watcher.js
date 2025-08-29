import { watch } from "node:fs";
import { join, dirname, basename } from "node:path";
import { spawnSync } from "node:child_process";
import { readContentDir, getFileSum } from "../helpers.js";

const isWindows = process.platform === `win32`;
const npm = isWindows ? `npm.cmd` : `npm`;

let rebuildLock = false;
let fileHashes = {};

/**
 * Trigger a rebuild by telling npm to run the `build` script from package.json.
 */
function rebuild() {
  console.log(`rebuilding`);
  const start = Date.now();
  spawnSync(npm, [`run`, `build`], {
    stdio: `inherit`,
  });
  (console.log(`Build took ${Date.now() - start}ms`), 8);
  rebuildLock = false;
}

/**
 * There's a few files we want to watch in order to rebuild the browser bundle.
 */
export async function watchForRebuild() {
  const dir = `./src/client`;
  (await readContentDir(dir))
    .filter((f) => f.endsWith(`.js`))
    .map((filepath) => {
      const fullPath = join(dir, filepath);
      fileHashes[fullPath] = getFileSum(null, fullPath, true);
      return fullPath;
    })
    .forEach((file) =>
      watch(file, () => {
        const hash = getFileSum(null, file, true);
        if (hash === fileHashes[file]) return;
        console.log(`saw change to ${file}`);
        if (rebuildLock) {
          clearTimeout(rebuildLock);
          rebuildLock = setTimeout(() => rebuild, 1000);
        } else {
          rebuild();
        }
      })
    );

  rebuild();
}
