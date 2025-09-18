import mime from "mime";

import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";

import { lstatSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { getAccessFor, MEMBER, touch } from "../../../database/index.js";
import {
  ROOT_DIR,
  CONTENT_DIR,
  createRewindPoint,
  execPromise,
  getFileSum,
  npm,
  pathExists,
  readContentDir,
} from "../../../../helpers.js";
import { applyPatch } from "../../../../../public/vendor/diff.js";

const contentDir = join(ROOT_DIR, CONTENT_DIR);

/**
 * ...docs go gere,,,
 */
export function createFile(req, res, next) {
  const { lookups, fullPath } = res.locals;
  const { project } = lookups;
  touch(project);
  const fileName = basename(fullPath);
  const dirs = dirname(fullPath);
  mkdirSync(dirs, { recursive: true });
  if (!pathExists(fullPath)) {
    if (fileName.includes(`.`)) {
      console.log(`writing out ${fullPath}`);
      writeFileSync(fullPath, ``);
    } else {
      mkdirSync(join(dirs, fileName));
    }
  }
  createRewindPoint(project);
  next();
}

/**
 * ...docs go here...
 */
export async function deleteFile(req, res, next) {
  const { lookups, fullPath } = res.locals;
  const { project } = lookups;
  touch(project);
  const isDir = lstatSync(fullPath).isDirectory();
  try {
    if (isDir) {
      rmSync(fullPath, { recursive: true });
    } else {
      unlinkSync(fullPath);
    }
    createRewindPoint(project);
    next();
  } catch (e) {
    console.error(e);
    next(new Error(`Could not delete ${fullPath}`));
  }
}

/**
 * ...docs go here...
 */
export async function formatFile(req, res, next) {
  const { lookups, fullPath } = res.locals;
  const { project } = lookups;
  touch(project);
  const ext = extname(fullPath);

  let formatted = false;

  if ([`.js`, `.css`, `.html`].includes(ext)) {
    try {
      const output = await execPromise(
        `${npm} run prettier:single -- "${fullPath}"`
      );
      console.log(output);
      formatted = true;
    } catch (e) {
      return next(
        new Error(`Prettier could not format file:\n` + e.toString())
      );
    }
  }

  if ([`.py`].includes(ext)) {
    try {
      await execPromise(`black "${fullPath}"`);
      formatted = true;
    } catch (e) {
      return next(new Error(`Black could not format file:\n` + e.toString()));
    }
  }

  res.locals.formatted = formatted;
  createRewindPoint(project);
  next();
}

/**
 * ...docs go here...
 * @returns
 */
export async function getDirListing(req, res, next) {
  const { user, lookups } = res.locals;
  const userName = user?.name;
  const { project } = lookups;

  const dirName = join(contentDir, project.slug);

  // Remove any "private" data from the dir listing if
  // the user has no access rights to them.
  const accessLevel = userName ? getAccessFor(user, project) : -1;

  const excludes = [`.container/**`];
  if (accessLevel < MEMBER) excludes.push(`.data/**`);
  res.locals.dirData = readContentDir(dirName, `*`, excludes);
  next();
}

/**
 * ...docs go here...
 */
export function getMimeType(req, res, next) {
  const { fullPath } = res.locals;
  const mimeType = mime.getType(fullPath);
  res.locals = {
    mimeType,
    data: readFileSync(fullPath),
  };
  next();
}

/**
 * ...docs go here...
 * @returns
 */
export function handleUpload(req, res, next) {
  const { lookups, fullPath } = res.locals;
  const { project } = lookups;
  touch(project);
  const fileData = req.body.content.value;
  const fileSize = fileData.length;
  if (fileSize > 10_000_000) {
    return next(new Error(`Upload size exceeded`));
  }
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, fileData, `ascii`);
  createRewindPoint(project);
  next();
}

/**
 * ...docs go here...
 */
export function patchFile(req, res, next) {
  const { lookups, fullPath } = res.locals;
  const { project } = lookups;
  touch(project);
  let data = readFileSync(fullPath).toString(`utf8`);
  const patch = req.body;
  const patched = applyPatch(data, patch);
  if (patched) writeFileSync(fullPath, patched);
  res.locals.fileHash = `${getFileSum(project.slug, fullPath, true)}`;
  createRewindPoint(project);
  next();
}

/**
 * ...docs go here...
 */
export async function moveFile(req, res, next) {
  const { lookups } = res.locals;
  const { project } = lookups;
  touch(project);
  const { slug } = project;
  const fileSlug = req.params.slug + req.params[0];
  const parts = fileSlug.split(`:`);
  const oldPath = join(ROOT_DIR, CONTENT_DIR, slug, parts[0]);
  if (oldPath === `.`) {
    return next(new Error(`Illegal rename`));
  }
  const newPath = join(ROOT_DIR, CONTENT_DIR, slug, parts[1]);
  try {
    renameSync(oldPath, newPath);
    createRewindPoint(project);
    next();
  } catch (e) {
    next(new Error(`Rename failed`));
  }
}
