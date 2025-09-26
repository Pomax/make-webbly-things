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
  return processFileHistory(projectSlug, filepath);
}

/**
 * ...docs go here...
 */
export function processFileHistory(projectSlug, filepath) {
  const cmd = `git --no-pager log --follow --patch -- ${filepath}`;
  const data = execSync(cmd, cwd(projectSlug)).toString();
  const lines = data.split(/\r?\n/);
  let commits = [];
  let currentCommit;

  do {
    const line = lines.shift();
    if (line.startsWith(`commit`)) {
      currentCommit?.finalize();
      currentCommit = new Commit(filepath);
      commits.push(currentCommit);
    }
    currentCommit?.addLine(line);
  } while (lines.length);

  const diffs = commits
    .map(({ timestamp, forward, reverse }) => ({
      timestamp,
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
    this.forward = processDiff(this.diff);
    this.reverse = reverseChanges(this.forward);
    this.forward = this.toDiff(this.forward);
    this.reverse = this.toDiff(this.reverse);
    delete this.diff;
  }

  toDiff({ rename, changes }) {
    // We're going to _completely_ ignore renames,
    // because the user doesn't care. They want their
    // file's content, across renames.
    if (rename) return false;
    return [
      `--- a/${this.filepath}`,
      `+++ b/${this.filepath}`,
      ...changes.map((c) => `@@ ${c.a} ${c.b} @@ ${c.lines.join(`\n`)}`),
    ].join(`\n`);
  }
}

/**
 * ...docs go here...
 */
function processDiff(diff) {
  if (diff.some((e) => e.startsWith(`rename from`))) {
    const full = diff.join(`\n`);
    const from = full.match(/^rename from (.*)$/m)[1].trim();
    const to = full.match(/^rename to (.*)$/m)[1].trim();
    return { rename: { from, to } };
  }

  const changes = [];
  let currentChange;
  for (let line of diff) {
    if (line.startsWith(`@@`)) {
      try {
        const [full, a, b] = line.match(/@@ (\S+) (\S+) @@[\s\r\n]*/);
        currentChange = { a, b, lines: [] };
        changes.push(currentChange);
        line = line.replace(full, ``);
        if (!line) continue;
      } catch (e) {
        console.log(line);
        throw e;
      }
    }
    currentChange?.lines.push(line);
  }

  return { changes };
}

/**
 * ...docs go here...
 */
function reverseChanges(diff) {
  if (diff.rename) {
    return {
      rename: {
        from: diff.rename.to,
        to: diff.rename.from,
      },
    };
  }

  if (diff.changes) {
    return {
      changes: diff.changes.map((c) => {
        let lines = [];
        let minus = [];
        let plus = [];

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

        if (minus.length || plus.length) {
          lines.push(...minus);
          lines.push(...plus);
        }

        return {
          a: c.b.replace(`+`, `-`),
          b: c.a.replace(`-`, `+`),
          lines,
        };
      }),
    };
  }
}
