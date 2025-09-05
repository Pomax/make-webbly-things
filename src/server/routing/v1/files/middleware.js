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
import { join, resolve } from "node:path";
import { getAccessFor, MEMBER, touch } from "../../../database/index.js";
import {
  CONTENT_DIR,
  createRewindPoint,
  execPromise,
  getFileSum,
  npm,
  pathExists,
  readContentDir,
} from "../../../../helpers.js";
import { applyPatch } from "../../../../../public/vendor/diff.js";

/**
 * ...docs go gere,,,
 */
export function createFile(req, res, next) {
  const { lookups, fileName } = res.locals;
  const { project } = lookups;
  touch(project);
  const slug = fileName.substring(fileName.lastIndexOf(`/`) + 1);
  const dirs = fileName.replace(`/${slug}`, ``);
  mkdirSync(dirs, { recursive: true });
  if (!pathExists(fileName)) {
    if (slug.includes(`.`)) {
      writeFileSync(fileName, ``);
    } else {
      mkdirSync(join(dirs, slug));
    }
  }
  createRewindPoint(project);
  next();
}

/**
 * ...docs go here...
 */
export async function deleteFile(req, res, next) {
  const { lookups, fileName } = res.locals;
  const { project } = lookups;
  touch(project);
  const fullPath = resolve(fileName);
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
  const { lookups, fileName } = res.locals;
  const { project } = lookups;
  touch(project);
  const ext = fileName.substring(fileName.lastIndexOf(`.`), fileName.length);

  let formatted = false;

  if ([`.js`, `.css`, `.html`].includes(ext)) {
    try {
      await execPromise(`${npm} run prettier -- ${fileName}`);
      formatted = true;
    } catch (e) {
      return next(
        new Error(`Prettier could not format file:\n` + e.toString()),
      );
    }
  }

  if ([`.py`].includes(ext)) {
    try {
      await execPromise(`black ${fileName}`);
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
  const projectSlug = project.slug;

  if (projectSlug) {
    const dirName = join(CONTENT_DIR, projectSlug);

    let dir = await readContentDir(dirName);
    if (dir === false) {
      return next(new Error(`read dir didn't work??`));
    }

    // Remove any "private" data from the dir listing if
    // the user has no access rights to them.
    const accessLevel = userName ? getAccessFor(user, project) : -1;

    // Users do not directly interact with the .container
    // folder. Instead its content is regulated via the
    // project settings.
    dir = dir.filter((v) => !v.match(/^\.container\b/));

    if (accessLevel < MEMBER) {
      // private data is only visible to owners, editors, and
      dir = dir.filter((v) => !v.match(/^\.data\b/));
    }

    res.locals.dir = dir;
  }
  next();
}

/**
 * ...docs go here...
 */
export function getMimeType(req, res, next) {
  const { fileName } = res.locals;
  const mimeType = mime.getType(fileName);
  res.locals = {
    mimeType,
    data: readFileSync(fileName),
  };
  next();
}

/**
 * ...docs go here...
 * @returns
 */
export function handleUpload(req, res, next) {
  const { lookups, fileName } = res.locals;
  const { project } = lookups;
  touch(project);
  const slug = fileName.substring(fileName.lastIndexOf(`/`) + 1);
  const dirs = fileName.replace(`/${slug}`, ``);
  const fileData = req.body.content.value;
  const fileSize = fileData.length;
  if (fileSize > 10_000_000) {
    return next(new Error(`Upload size exceeded`));
  }
  mkdirSync(dirs, { recursive: true });
  writeFileSync(fileName, fileData, `ascii`);
  createRewindPoint(project);
  next();
}

/**
 * ...docs go here...
 */
export function patchFile(req, res, next) {
  const { lookups, fileName } = res.locals;
  const { project } = lookups;
  touch(project);
  let data = readFileSync(fileName).toString(`utf8`);
  const patch = req.body;
  const patched = applyPatch(data, patch);
  if (patched) writeFileSync(fileName, patched);
  res.locals.fileHash = `${getFileSum(project.slug, fileName, true)}`;
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
  const oldPath = join(CONTENT_DIR, slug, parts[0]);
  if (oldPath === `.`) {
    return next(new Error(`Illegal rename`));
  }
  const newPath = join(CONTENT_DIR, slug, parts[1]);
  try {
    renameSync(oldPath, newPath);
    createRewindPoint(project);
    next();
  } catch (e) {
    next(new Error(`Rename failed`));
  }
}
