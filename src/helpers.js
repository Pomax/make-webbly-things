import net from "node:net";
import { join, resolve, sep, posix } from "node:path";
import { exec, execSync } from "node:child_process";
import { existsSync, globSync, lstatSync, readFileSync } from "node:fs";
import * as AuthSettings from "./server/routing/auth/settings.js";
import express from "express";
import nocache from "nocache";
import helmet from "helmet";
import asciify from "any-ascii";

// Explicit env loading as we rely on process.env
// at the module's top level scope...
import dotenv from "@dotenvx/dotenvx";
const envPath = join(import.meta.dirname, `../.env`);
dotenv.config({ path: envPath, quiet: true });

export const TESTING = process.env.NODE_ENV === `TESTING`;

export const isWindows = process.platform === `win32`;
export const npm = isWindows ? `npm.cmd` : `npm`;
export const npx = isWindows ? `npx.cmd` : `npx`;

// Set up the vars we need for pointing to the right dirs
export const ROOT_DIR = resolve(join(import.meta.dirname, `..`));
export const CONTENT_BASE = process.env.CONTENT_BASE ?? `content`;
process.env.CONTENT_BASE = CONTENT_BASE;

export const CONTENT_DIR = isWindows ? CONTENT_BASE : `./${CONTENT_BASE}`;
process.env.CONTENT_DIR = CONTENT_DIR;

export const STARTER_BASE = join(CONTENT_BASE, `__starter_projects`);
export const STARTER_DIR = isWindows ? STARTER_BASE : `./${STARTER_BASE}`;

// Make sure all the CSP directives that need clearing are set to cleared
const CSP_DIRECTIVES = {
  connectSrc: `* data: blob: 'unsafe-inline'`,
  defaultSrc: `* data: mediastream: blob: filesystem: about: ws: wss: 'unsafe-eval' 'unsafe-inline'`,
  fontSrc: `* data: blob: 'unsafe-inline'`,
  formAction: `'self'`,
  frameAncestors: `'self' * data: blob:`,
  frameSrc: `'self' * data: blob:`,
  imgSrc: `* data: blob: 'unsafe-inline'`,
  mediaSrc: `* data: blob: 'unsafe-inline'`,
  scriptSrc: `* data: blob: 'unsafe-inline' 'unsafe-eval'`,
  scriptSrcElem: `* data: blob: 'unsafe-inline'`,
  styleSrc: `* data: blob: 'unsafe-inline'`,
};

/**
 * A little wrapper that turns exec() into an async rather than callback call.
 */
export async function execPromise(command, options = {}) {
  return new Promise((resolve, reject) =>
    exec(command, options, (err, stdout, stderr) => {
      if (err) return reject(stderr);
      resolve(stdout.trim());
    }),
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
export function readContentDir(dir, fileMatcher = `*`, excludes = []) {
  let dirs = [];
  let files = globSync(`./**/${fileMatcher}`, {
    cwd: dir,
    ignore: [`.git/**`, ...excludes],
  }).filter((path) => {
    try {
      const s = lstatSync(join(dir, path));
      if (s.isFile()) return true;
      dirs.push(path);
      return false;
    } catch (e) {
      // transient files like .journal files may
      // vanish between "ls" and "stat" operations.
      return false;
    }
  });

  if (isWindows) {
    dirs = dirs.map((v) => v.split(sep).join(posix.sep));
    files = files.map((v) => v.split(sep).join(posix.sep));
  }

  return { dirs, files };
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
  const directives = structuredClone(CSP_DIRECTIVES);
  AuthSettings.updateCSPDirectives(directives);
  app.use(helmet.contentSecurityPolicy({ directives }));
}

/**
 * Make git not guess at the name and email for commits.
 */
export async function setupGit(dir, projectSlug) {
  for (let cfg of [
    `init.defaultBranch main`,
    `user.name "${projectSlug}"`,
    `user.email "actions@makewebblythings.local"`,
  ]) {
    await execPromise(`git config --local ${cfg}`, { cwd: dir });
  }
}

/**
 * ...docs go here...
 */
export function slugify(text) {
  text = text.replaceAll(`/`, `-`).replaceAll(`.`, ``);
  text = asciify(text).toLowerCase();
  return text
    .replace(/\s+/g, `-`)
    .replace(/[<\._>]/g, ``)
    .replace(
      /[\u0021-\u002C\u002E-\u002F\u003A-\u0040\u005B-\u0060\u007B-\u00BF]+/g,
      ``,
    )
    .replace(/×/g, `x`)
    .replace(/÷/g, ``)
    .replace(/--+/g, `-`);
}
