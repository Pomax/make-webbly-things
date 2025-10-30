import { watch } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { readContentDir, getFileSum } from "../helpers.js";

const isWindows = process.platform === `win32`;
const npm = isWindows ? `npm.cmd` : `npm`;

let rebuildLock = false;
const fileHashes = {};

/**
 * Trigger a rebuild by telling npm to run the `build` script from package.json.
 */
function rebuild() {
  console.log(`rebuilding`);
  const start = Date.now();
  execSync(`${npm} run bundle`, { stdio: `inherit` });
  console.log(`Build took ${Date.now() - start}ms`);
  rebuildLock = false;
}

/**
 * There's a few files we want to watch in order to rebuild the browser bundle.
 */
export async function watchForRebuild() {
  const dir = `./src/client`;
  const { files } = readContentDir(dir, `*.js`);
  files
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
      }),
    );

  rebuild();
}
