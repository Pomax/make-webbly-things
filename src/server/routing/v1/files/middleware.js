import mime from "mime";
import { basename, dirname, extname, join, sep } from "node:path";
import {
  getAccessFor,
  isStarterProject,
  MEMBER,
  touch,
} from "../../../database/index.js";
import { applyPatch } from "../../../../../public/vendor/diff.js";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import {
  CONTENT_BASE,
  CONTENT_DIR,
  execPromise,
  getFileSum,
  npm,
  pathExists,
  readContentDir,
  ROOT_DIR,
  STARTER_BASE,
  STARTER_DIR,
} from "../../../../helpers.js";
import * as GitUtils from "../../../git/git-utils.js";
const { createRewindPoint } = GitUtils;

const contentDir = join(ROOT_DIR, CONTENT_DIR);
const starterDir = join(ROOT_DIR, STARTER_DIR);

/**
 * ...docs go here...
 */
export async function confirmAccessToFile(req, res, next) {
  const { filename, lookups } = res.locals;
  const { project } = lookups;
  const isStarter = isStarterProject(project);

  let { fullPath } = res.locals;
  if (isStarter) {
    fullPath = res.locals.fullPath = fullPath.replace(
      CONTENT_BASE,
      STARTER_BASE,
    );
  }

  const nope = (msg = `Unknown file`) => next(new Error(msg));

  if (!existsSync(fullPath)) {
    return nope();
  }

  if (lstatSync(fullPath).isDirectory()) {
    return nope(`Path is not a file`);
  }

  if (filename.startsWith(`.git${sep}`)) {
    return nope();
  }

  if (filename.startsWith(`.container${sep}`)) {
    return nope();
  }

  if (filename.startsWith(`.data${sep}`)) {
    const { user } = res.locals;
    const { project } = res.locals.lookups;
    if (!user) return nope();
    if (!project) return nope();
    const access = getAccessFor(user, project);
    if (access < MEMBER) return nope();
  }

  next();
}

/**
 * ...docs go gere,,,
 */
export async function createFile(req, res, next) {
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
      await execPromise(`${npm} run prettier:single -- "${fullPath}"`);
      formatted = true;
    } catch (e) {
      return next(
        new Error(`Prettier could not format file.\n${e.toString()}`),
      );
    }
  }

  if ([`.py`].includes(ext)) {
    try {
      await execPromise(`black "${fullPath}"`);
      formatted = true;
    } catch (e) {
      return next(new Error(`Black could not format file:\n${e.toString()}`));
    }
  }

  res.locals.formatted = formatted;
  createRewindPoint(project);
  next();
}

/**
 * ...docs go here...
 */
export async function getDirListing(req, res, next) {
  const { user, lookups } = res.locals;
  const userName = user?.name;
  const { project } = lookups;
  const isStarter = isStarterProject(project);

  const dirName = join(isStarter ? starterDir : contentDir, project.slug);

  // Remove any "private" data from the dir listing if
  // the user has no access rights to them.
  const accessLevel = !isStarter && userName ? getAccessFor(user, project) : -1;

  const excludes = [`.container/**`];
  if (accessLevel < MEMBER) excludes.push(`.data/**`);
  res.locals.dirData = readContentDir(dirName, `*`, excludes);
  next();
}

/**
 * ...docs go here ...
 */
export async function getFileHistory(req, res, next) {
  res.locals.fileHistory = GitUtils.getFileHistory(
    res.locals.lookups.project.slug,
    res.locals.filename,
  );
  next();
}

/**
 * ...docs go here...
 */
export async function getMimeType(req, res, next) {
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
export async function handleUpload(req, res, next) {
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
export async function patchFile(req, res, next) {
  const { lookups, fullPath } = res.locals;
  const { project } = lookups;
  touch(project);
  const data = readFileSync(fullPath).toString(`utf8`);
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
