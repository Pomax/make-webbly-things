import net from "node:net";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { join, resolve, sep, posix } from "node:path";
import { exec } from "node:child_process";
import express from "express";
import nocache from "nocache";
import helmet from "helmet";
import ubase from "ubase.js";

// It's a bit silly that we need this import here, and a
// strong signal that the `createRewindPoint` does not
// belong in this helpers file, but should probably
// go in the v1/files middleware file, as it's related
// to creating git commits based on file edits.
import { touch } from "./server/database/project.js";

// Explicit env loading as we rely on process.env
// at the module's top level scope...
import dotenv from "@dotenvx/dotenvx";
dotenv.config({ quiet: true });

export const isWindows = process.platform === `win32`;
export const npm = isWindows ? `npm. cmd` : `npm`;

// Set up the vars we need for pointing to the right dirs
export const CONTENT_BASE = process.env.CONTENT_BASE ?? `content`;
process.env.CONTENT_BASE = CONTENT_BASE;

export const CONTENT_DIR = isWindows ? CONTENT_BASE : `./${CONTENT_BASE}`;
process.env.CONTENT_DIR = CONTENT_DIR;

// Set up the things we need for scheduling git commits when
// content changes, or the user requests an explicit rewind point:
const COMMIT_TIMEOUT_MS = 5_000;

// We can't save timeouts to req.session so we need a separate tracker
const COMMIT_TIMEOUTS = {};

/**
 * Schedule a git commit to capture all changes since the last time we did that.
 * @param {*} projectName
 * @param {*} reason
 */
export function createRewindPoint(projectName, reason) {
  console.log(`scheduling rewind point`);

  // An edit happened, clearly, so touch the project.
  touch(projectName);

  const now = scrubDateTime(new Date().toISOString());
  reason = reason || `Autosave (${now})`;

  const dir = join(CONTENT_DIR, projectName);
  const debounce = COMMIT_TIMEOUTS[projectName];

  if (debounce) clearTimeout(debounce);

  COMMIT_TIMEOUTS[projectName] = setTimeout(async () => {
    console.log(`creating rewind point`);
    const cmd = `cd ${dir} && git add . && git commit --allow-empty -m "${reason}"`;
    console.log(`running:`, cmd);
    try {
      await execPromise(cmd);
    } catch (e) {
      console.error(e);
    }
    COMMIT_TIMEOUTS[projectName] = undefined;
  }, COMMIT_TIMEOUT_MS);
}

/**
 * A little wrapper that turns exec() into an async rather than callback call.
 */
export async function execPromise(command, options = {}) {
  return new Promise((resolve, reject) =>
    exec(command, options, (err, stdout, stderr) => {
      if (err) return reject(stderr);
      resolve(stdout.trim());
    })
  );
}

/**
 * Create a super simple hash digest by summing all bytes in the file.
 * We don't need cryptographically secure, we're just need it to tell
 * whether a file on-disk and the same file in the browser differ, and
 * if they're not, the browser simply redownloads the file.
 */
export function getFileSum(dir, filename, noFill = false) {
  const filepath = noFill ? filename : `${dir}/${filename}`;
  const enc = new TextEncoder();
  return enc.encode(readFileSync(filepath)).reduce((t, e) => t + e, 0);
}

/**
 * Used for docker bindings
 */
export function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const { port } = server.address();
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

/**
 * ...docs go here...
 */
export function makeSafeProjectName(name) {
  return name.toLowerCase().replace(/\s+/g, `-`);
}

/**
 * You'd think existSync is enough, but no,
 * it's unreliable on Windows, where checking
 * for a file that doesn't exist may report
 * "true" if that file eventually gets written
 * and I have no idea why. Super fun bug.
 */
export function pathExists(path) {
  try {
    const stats = lstatSync(path);
    if (stats.isDirectory()) return true;
    return existsSync(path) && stats.size > 0;
  } catch (e) {}
  return false;
}

/**
 * Ask the OS for a flat dir listing.
 */
export async function readContentDir(dir) {
  let dirListing;
  let listCommand = isWindows ? `dir /b/o/s "${dir}"` : `find ${dir}`;

  try {
    dirListing = await execPromise(listCommand);
  } catch (e) {
    // This can happen if the server reboots but the client didn't
    // reload, leading to a session name mismatch.
    console.warn(e);
    return false;
  }

  let filtered = dirListing.split(/\r?\n/);

  if (isWindows) {
    const prefix = resolve(dir) + `\\`;
    filtered = filtered.map((v) =>
      v.replace(prefix, ``).split(sep).join(posix.sep)
    );
  } else {
    const prefix = new RegExp(`.*${dir}\\/`);
    filtered = filtered.map((v) => v.replace(prefix, ``));
  }

  // Never expose the git directory.
  filtered = filtered.filter((v) => !!v && !v.startsWith(`.git`) && v !== dir);

  return filtered;
}

/**
 * ...docs go here...
 */

export function safify(text) {
  return text.replaceAll(`<`, `&lt;`).replaceAll(`>`, `&gt;`);
}

/**
 * ...docs go here...
 */
export function scrubDateTime(datetime) {
  return datetime.replace(`T`, ` `).replace(`Z`, ``).replace(/\.\d+/, ``);
}

/**
 * ...docs go here...
 */
export function setDefaultAspects(app) {
  app.set("etag", false);
  app.use(nocache());
  app.use(express.urlencoded({ extended: true }));
  app.use(
    helmet.contentSecurityPolicy({
      directives: {
        connectSrc: `* data: blob: 'unsafe-inline'`,
        defaultSrc: `* data: mediastream: blob: filesystem: about: ws: wss: 'unsafe-eval' 'unsafe-inline'`,
        fontSrc: `* data: blob: 'unsafe-inline'`,
        frameAncestors: `* data: blob: 'unsafe-inline'`,
        frameSrc: `* data: blob:`,
        imgSrc: `* data: blob: 'unsafe-inline'`,
        mediaSrc: `* data: blob: 'unsafe-inline'`,
        scriptSrc: `* data: blob: 'unsafe-inline' 'unsafe-eval'`,
        scriptSrcElem: `* data: blob: 'unsafe-inline'`,
        styleSrc: `* data: blob: 'unsafe-inline'`,
      },
    })
  );
}

/**
 * Make git not guess at the name and email for commits.
 */
export async function setupGit(dir, projectName) {
  for (let cfg of [
    `init.defaultBranch main`,
    `user.name "${projectName}"`,
    `user.email "actions@browsertests.local"`,
  ]) {
    await execPromise(`git config --local ${cfg}`, { cwd: dir });
  }
}

/**
 * ...docs go here...
 */

export function slugify(text) {
  return ubase
    .basify(text)
    .toLowerCase()
    .replace(/\s+/g, `-`)
    .replace(
      /[\u0021-\u002C\u002E-\u002F\u003A-\u0040\u005B-\u0060\u007B-\u00BF]+/g,
      ``
    )
    .replace(/×/g, `x`)
    .replace(/÷/g, ``)
    .replace(/--+/g, `-`);
}
