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
 * Convert a file-specific git log (with renames) to a sequence
 * of diffs that can either be applied both forward, and in reverse,
 * using jsdiff's applyPatch() function, or can be checked for
 * rename, create, or delete flags to bypass "diffing" and
 * instead do what needs to be done based on the operation.
 */
export function getFileHistory(projectSlug, filepath) {
  if (filepath.includes(`..`)) return ``;
  const cmd = `git --no-pager log --follow --patch --simplify-merges -- ${filepath}`;
  const data = execSync(cmd, cwd(projectSlug)).toString();
  return processFileHistory(filepath, data);
}

/**
 * Ingest a git log, and return a sequence of operations
 * that are diffs (both forward and reverse), or special
 * rename, create, or delete operation objects.
 */
export function processFileHistory(filepath, data) {
  const lines = data.split(/\r?\n/);
  let commits = [];
  let currentCommit;

  do {
    const line = lines.shift();
    if (line.startsWith(`commit `)) {
      currentCommit?.finalize();
      currentCommit = new Commit(filepath);
      commits.push(currentCommit);
    }
    currentCommit?.addLine(line);
  } while (lines.length);
  currentCommit?.finalize();

  const diffs = commits
    .map(({ hash, timestamp, original, forward, reverse }) => ({
      hash,
      timestamp,
      original,
      forward,
      reverse,
    }))
    .filter((e) => !!e.forward);

  return diffs;
}

/**
 * ...docs go here...
 */
class Commit {
  message = [];
  diff; // array
  constructor(filepath) {
    this.filepath = filepath;
  }
  addLine(line) {
    if (line.startsWith(`commit`))
      return (this.hash = line.replace(`commit `, ``));
    if (line.startsWith(`Author:`))
      return (this.author = line.replace(/Author:\s+/, ``));
    if (line.startsWith(`Date:`)) {
      this.date = line.replace(/Date:\s+/, ``);
      this.timestamp = Date.parse(this.date);
      return;
    }
    if (line.startsWith(`diff `)) this.diff = [];
    if (this.diff) return this.diff.push(line);
    // don't really need an "else" here...
    else {
      line = line.trim();
      if (line) this.message.push(line);
      return;
    }
  }
  finalize() {
    this.original = this.diff.join(`\n`);
    this.forward = processDiff(this.diff);
    this.reverse = reverseChanges(this.forward);
    this.forward = this.backToDiff(this.forward);
    this.reverse = this.backToDiff(this.reverse);
    delete this.diff;
  }

  backToDiff(data) {
    if (data.rename) {
      // We're going to _completely_ ignore renames, because
      // the user doesn't care. They want their file's content,
      // irrespective of whether the file got renamed or not.
      return false;
    }

    if (data.create) return data;
    if (data.delete) return data;

    return [
      `--- a/${this.filepath}`,
      `+++ b/${this.filepath}`,
      ...data.changes.map(
        (c) => `@@ ${c.a} ${c.b} @@${c.suffix}\n${c.lines.join(`\n`)}`,
      ),
    ].join(`\n`);
  }
}

/**
 * ...docs go here...
 */
function processDiff(diff) {
  // is this a rename commit?
  if (diff.some((e) => e.startsWith(`rename from`))) {
    const full = diff.join(`\n`);
    const from = full.match(/^rename from (.*)$/m)[1].trim();
    const to = full.match(/^rename to (.*)$/m)[1].trim();
    return { rename: { from, to } };
  }

  // If not, is it a "create" commit?
  if (diff.some((e) => e.startsWith(`--- /dev/null`))) {
    const data = diff.join(`\n`).replaceAll(`\n+`, `\n`);
    const mark = data.lastIndexOf(` @@\n`) + 4;
    return {
      create: {
        data: data.substring(mark),
      },
    };
  }

  // If not, is it a "delete" commit?
  if (diff.some((e) => e.startsWith(`+++ /dev/null`))) {
    const data = diff.join(`\n`).replaceAll(`\n-`, `\n`);
    const mark = data.lastIndexOf(` @@\n`) + 4;
    return {
      delete: {
        data: data.substring(mark),
      },
    };
  }

  // If not, that leaves a regular content change
  const changes = [];
  let currentChange;
  for (let line of diff) {
    if (line.startsWith(`@@`)) {
      const [_, a, b, suffix] = line.match(/@@ (\S+) (\S+) @@(.*)/);
      currentChange = { a, b, suffix, lines: [] };
      changes.push(currentChange);
      continue;
    }
    currentChange?.lines.push(line);
  }

  return { changes };
}

/**
 * ...docs go here...
 */
function reverseChanges(diff) {
  // a reverse create is a delete
  if (diff.create) {
    return { delete: diff.create };
  }

  // and a reverse delete, of course, a create
  if (diff.delete) {
    return { create: diff.delete };
  }

  // a reverse rename is still pretty obvious
  if (diff.rename) {
    return {
      rename: {
        from: diff.rename.to,
        to: diff.rename.from,
      },
    };
  }

  // which just leaves the "real" reversal.
  if (diff.changes) {
    return {
      changes: diff.changes.map((c) => {
        let lines = [];
        let minus = [];
        let plus = [];

        // Aggregate lines until we hit a change block.
        // When we do, add all `-` lines to "minus", and
        // all `+` lines to "plus", so that when we hit
        // the end of that change block, we can insert
        // those changes as "minus" followed by "plus".
        c.lines.forEach((l) => {
          if (l.startsWith(`-`)) {
            plus.push(l.replace(`-`, `+`));
          } else if (l.startsWith(`+`)) {
            minus.push(l.replace(`+`, `-`));
          } else {
            if (minus.length || plus.length) {
              lines.push(...minus);
              lines.push(...plus);
              minus = [];
              plus = [];
            }
            lines.push(l);
          }
        });

        // And remember to check that one last time:
        if (minus.length || plus.length) {
          lines.push(...minus);
          lines.push(...plus);
        }

        // We're done, provided we also remember to
        // switch the @@ -..., +... @@ numbers around:
        return {
          a: c.b.replace(`+`, `-`),
          b: c.a.replace(`-`, `+`),
          suffix: c.suffix,
          lines,
        };
      }),
    };
  }
}
