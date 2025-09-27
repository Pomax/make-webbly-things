import { join, resolve } from "node:path";

import {
  NOT_ACTIVATED,
  MEMBER,
  OWNER,
  getAccessFor,
  getMostRecentProjects,
  getProject,
  getProjectListForUser,
  getUser,
  userIsAdmin,
  getUserSuspensions,
  hasAccessToUserRecords,
  getStarterProjects,
} from "../database/index.js";

import { getServiceDomain, validProviders } from "./auth/settings.js";

import { ROOT_DIR, CONTENT_DIR, slugify } from "../../helpers.js";

/**
 * For when you really don't want response caching.
 */
export function nocache(req, res, next) {
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.setHeader("Expires", "0");
  next();
}

/**
 * ...docs go here...
 */
export function noStaticHTML(req, res, next) {
  if (req.path.endsWith(".html") && !req.path.includes(`/default/`)) {
    return next(new Error(`There is no HTML here`));
  }
  next();
}

/**
 * Send a 404
 * @param {*} req
 * @param {*} res
 */
export function pageNotFound(req, res) {
  if (req.query.preview) {
    res.status(404).send(`Preview not found`);
  } else {
    res.status(404).send(`${req.url} not found`);
  }
}

/**
 * ...docs go here...
 */
export async function bindUser(req, res = { locals: {} }, next = () => {}) {
  let fallback = {};

  if (process.argv.includes(`--admin-mode`)) {
    const user = getUser(1);
    user.admin = true;
    fallback = { user };
  }

  const { user } = req.session.passport ?? fallback;
  res.locals.user = user;
  next();
  return user;
}

/**
 * ...docs go here...
 * @returns
 */
export async function verifyLogin(req, res, next) {
  const { user } = res.locals;
  if (!user) {
    return next(new Error(`Not logged in`));
  }
  const u = getUser(user.id);
  if (!u.enabled_at) {
    return next(new Error(`This user account has not been actived yet`));
  }
  const suspensions = getUserSuspensions(u);
  if (suspensions.length) {
    return next(
      new Error(
        `This user account has been suspended (${suspensions.map((s) => `"${s.reason}"`).join(`, `)})`,
      ),
    );
  }
  bindUser(req, res, next);
}

/**
 * ...docs go here...
 */
export function verifyAdmin(req, res, next) {
  if (userIsAdmin(res.locals.user)) {
    res.locals.adminCall = true;
    next();
  } else {
    next(new Error(`You're not an admin`));
  }
}

/**
 * ...docs go here...
 * @returns
 */
export function verifyAccesToUser(req, res, next) {
  const { user, lookups } = res.locals;
  if (!lookups.user) return next(new Error(`No such user`));
  if (hasAccessToUserRecords(user, lookups.user)) {
    next();
  } else {
    next(new Error(`Access denied`));
  }
}

/**
 * ...docs go here...
 * @returns
 */
export function verifyEditRights(req, res, next) {
  const { user, lookups } = res.locals;
  const { project } = lookups;
  const accessLevel = getAccessFor(user, project);
  if (accessLevel === NOT_ACTIVATED)
    return next(new Error(`Your account has not been activated yet`));
  if (accessLevel < MEMBER) return next(new Error(`Incorrect access level`));
  next();
}

/**
 * ...docs go here...
 * @returns
 */
export function verifyOwner(req, res, next) {
  const { user, lookups } = res.locals;
  const { project } = lookups;
  const accessLevel = getAccessFor(user, project);
  if (accessLevel === NOT_ACTIVATED)
    return next(new Error(`Your account has not been activated yet`));
  if (accessLevel < OWNER) return next(new Error(`Incorrect access level`));
  next();
}

/**
 * ...docs go here...
 * @returns
 */
export function bindCommonValues(req, res, next) {
  const { uid, user, pid, project, filename, starter } = req.params;

  // Bind the session user as res.locals.user
  bindUser(req, res);

  // Build route lookup locals
  res.locals.lookups ??= {};

  if (uid) {
    try {
      res.locals.lookups.user = getUser(parseFloat(uid));
    } catch (e) {
      console.error(e);
      return next(e);
    }
  }

  if (user) {
    const slug = slugify(user.trim());
    try {
      res.locals.lookups.user = getUser(slug);
    } catch (e) {
      console.error(e);
      return next(e);
    }
  }

  if (pid) {
    try {
      res.locals.lookups.project = getProject(parseFloat(pid));
    } catch (e) {
      console.error(e);
      return next(e);
    }
  }

  if (project) {
    const slug = slugify(project.trim());
    try {
      res.locals.lookups.project = getProject(slug);
    } catch (e) {
      console.error(e);
      return next(e);
    }
  }

  if (res.locals.lookups.project) {
    const { settings } = res.locals.lookups.project;
    res.locals.app_type = settings.app_type;
  }

  if (starter) {
    try {
      // we "know" starters are safe, but URLs are user controlled.
      res.locals.starter = getProject(slugify(starter));
    } catch (e) {
      console.error(e);
      return next(e);
    }
  }

  if (filename) {
    try {
      parseFileName(req, res, filename);
    } catch (e) {
      return next(e);
    }
  }

  next();
}

/**
 * internal function for turning a filename argument
 * into a full qualified path in the file system.
 */
function parseFileName(req, res, filename) {
  const projectSlug =
    res.locals.lookups.project?.slug ?? res.locals.projectSlug;
  const suffix = req.params[0] || ``;
  // Let's cut short any "filesystem escapes":
  if (projectSlug.includes(`..`)) {
    throw new Error(`Cannot resolve relative path`);
  }
  if ((filename + suffix).includes(`..`)) {
    throw new Error(`Cannot resolve relative path`);
  }
  res.locals.filename = filename + suffix;
  const fullPath = (res.locals.fullPath = resolve(
    join(ROOT_DIR, CONTENT_DIR, projectSlug, filename + suffix),
  ));
  const apath = resolve(join(CONTENT_DIR, projectSlug));
  const bpath = resolve(fullPath);
  if (!bpath.startsWith(apath)) {
    throw new Error(`Illegal file path`);
  }
}

/**
 * ...docs go here...
 */
export function loadProjectList(req, res, next) {
  // FIXME: this shouldn't blindly rebuild the list every time,
  //        creating or deleting projects should invalidate the
  //        list but otherwise we should reuse what's there.
  //        https://github.com/Pomax/make-webbly-things/issues/112
  const { user } = res.locals;
  if (user) {
    res.locals.projectList = getProjectListForUser(user);
  } else {
    res.locals.projectList = getMostRecentProjects(5);
  }
  next();
}

/**
 * ...docs go here...
 */
export function loadProviders(req, res, next) {
  res.locals.availableProviders = validProviders.map((name) => ({
    service: name,
    service_domain: getServiceDomain(name),
  }));
  next();
}

/**
 * ...docs go here...
 */
export function loadStarters(req, res, next) {
  res.locals.starters = getStarterProjects();
  next();
}

/**
 * ...docs go here...
 */
export async function parseBodyText(req, res, next) {
  let chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    req.body = Buffer.concat(chunks).toString(`utf-8`);
    next();
  });
}

function getDelimiter(req) {
  const ctt = req.header(`content-type`);
  if (!ctt.includes(`multipart/form-data`))
    throw new Error(`Not multipart/form-data.`);
  const boundary = ctt.match(/boundary=([^\s;]+)/)?.[1];
  if (!boundary) throw new Error(`No boundary found.`);
  return `--${boundary}\r\n`;
}

/**
 * ...docs go here...
 */
export async function parseMultiPartBody(req, res, next) {
  const delimiter = getDelimiter(req);
  const endMarker = delimiter.replace(`\r\n`, ``) + `--`;

  const data = await (() => {
    let chunks = [];
    return new Promise((resolve, reject) => {
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", () => reject());
    });
  })();

  const parts = [];
  const flatString = [...data].map((v) => String.fromCharCode(v)).join(``); // woo this isn't inefficient at all!
  const blocks = flatString.split(delimiter);
  const HEADER = Symbol(`MULTIPART/FORM PART HEADER`);
  const CONTENT = Symbol(`MULTIPART/FORM PART CONTENT`);

  blocks.forEach((block, i) => {
    if (block.length === 0) return;

    const part = {
      name: `none`,
      type: `text/plain`,
      value: ``,
      encoding: `utf-8`,
    };

    parts.push(part);

    let parseMode = HEADER;

    do {
      if (parseMode === HEADER) {
        const cut = block.indexOf(`\r\n`) + 2;
        let line = block.substring(0, cut);
        block = block.substring(cut);

        if (line.includes(`Content-Disposition`)) {
          const name = line.match(/name="([^"]+)"/)?.[1];
          if (!name)
            throw new Error(`Content-Disposition is missing field name!`);
          part.name = name;
          const filename = line.match(/filename="([^"]+)"/)?.[1];
          if (filename) {
            part.filename = filename;
          }
        } else if (line.includes(`Content-Type`)) {
          const ctt = line.match(/Content-Type: ([^\s;]+)/)?.[1];
          if (ctt) {
            part.type = ctt;
          }
        } else if (line.includes(`Content-Transfer-Encoding`)) {
          const cte = line.match(/Content-Transfer-Encoding: ([^\s;]+)/)?.[1];
          if (cte) {
            part.encoding = cte;
          }
        } else if (line === `\r\n`) {
          parseMode = CONTENT;
        }
      } else if (parseMode === CONTENT) {
        // Either this is the last block and the data ends in the end marker,
        let cut = block.indexOf(endMarker) - 2;
        // or it's not, and the block ends in \r\n
        if (cut < 0) cut = block.length - 2;
        part.value = block.substring(0, cut);
        break;
      }
    } while (block.length);
  });

  req.body ??= {};
  parts.forEach((part) => (req.body[part.name] = part));
  next();
}
