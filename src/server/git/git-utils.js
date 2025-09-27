import { execSync } from "node:child_process";
import { join } from "node:path";
import * as Helpers from "../../helpers.js";

const { TESTING } = Helpers;
const CONTENT_DIR = TESTING ? `.` : Helpers.CONTENT_DIR;

function cwd(projectSlug) {
  return {
    cwd: join(CONTENT_DIR, projectSlug),
  };
}

/**
 * ...docs go here...
 */
export function getFileHistory(projectSlug, filepath) {
  if (filepath.includes(`..`)) return ``;
  const history = execSync(
    `git --no-pager log --follow --pretty=tformat:'%H' -- "${filepath}"`,
    cwd(projectSlug),
  ).toString();
  console.log(history);
  return createDiffsFromGitLog(history, projectSlug, filepath);
}

/**
 * Turn the git log into an array of forward/reverse diff pairs
 */
function createDiffsFromGitLog(history, projectSlug, filepath) {
  const hashes = history.split(/\r?\n/).filter(Boolean);

  const pairs = hashes.map((e, i) => {
    return [hashes[i], hashes[i + 1]];
  });

  return pairs.map(([newer, older]) => {
    const datetime = execSync(
      `git show -s --format=%ci ${newer}`,
      cwd(projectSlug),
    ).toString();
    const timestamp = Date.parse(datetime);

    if (!older) {
      const forward = execSync(
        `git show ${newer} -- ${filepath}`,
        cwd(projectSlug),
      ).toString();
      return {
        timestamp,
        forward: forward.substring(forward.indexOf(`\n---`) + 1),
      };
    }

    const forward = execSync(
      `git diff ${older} ${newer} -- ${filepath}`,
      cwd(projectSlug),
    ).toString();

    const reverse = execSync(
      `git diff ${newer} ${older} -- ${filepath}`,
      cwd(projectSlug),
    ).toString();

    return {
      timestamp,
      forward: forward.substring(forward.indexOf(`\n---`) + 1),
      reverse: reverse.substring(reverse.indexOf(`\n---`) + 1),
    };
  });
}
