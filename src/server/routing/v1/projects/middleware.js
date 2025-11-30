import { join, resolve } from "node:path";

import {
  cpSync,
  createReadStream,
  createWriteStream,
  existsSync,
  globSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import archiver from "archiver";

import {
  CONTENT_DIR,
  execPromise,
  pathExists,
  setupGit,
  slugify,
} from "../../../../helpers.js";

import {
  checkContainerHealth,
  deleteContainerAndImage,
  getContainerLogs,
  renameContainer,
  restartContainer,
  runContainer,
  runStaticServer,
  stopContainer,
  stopStaticServer,
} from "../../../docker/docker-helpers.js";

import {
  MEMBER,
  OWNER,
  copyProjectSettings,
  createProjectForUser,
  deleteProjectForUser,
  getAccessFor,
  getProjectSuspensions,
  isProjectSuspended,
  isStarterProject,
  projectSuspendedThroughOwner,
  recordProjectRemix,
  updateSettingsForProject,
} from "../../../database/index.js";

import { portBindings, removeCaddyEntry } from "../../../caddy/caddy.js";
import { runProject } from "../../../database/project.js";
import { addGitTracking } from "../../../git/git-utils.js";

/**
 * ...docs go here...
 */
export async function checkProjectHealth(req, res, next) {
  const { project } = res.locals.lookups;
  const binding = portBindings[project.slug];
  if (!binding) {
    res.locals.healthStatus = `failed`;
    return next();
  }
  if (binding.serverProcess) {
    try {
      await fetch(`http://localhost:${binding.port}`);
      res.locals.healthStatus = `ready`;
    } catch (e) {
      res.locals.healthStatus = `failed`;
    }
  } else {
    res.locals.healthStatus = checkContainerHealth(project);
  }
  next();
}

/**
 * ...docs go here...
 */
function cloneProject(project, slug, isStarter) {
  let source = project.slug;
  const dir = join(CONTENT_DIR, slug);
  const tempDir = join(CONTENT_DIR, `__${slug}`);

  if (isStarter) {
    source = `__starter_projects/${source || `empty`}`;
  }

  if (!pathExists(dir) && !pathExists(tempDir)) {
    mkdirSync(tempDir);
    mkdirSync(dir);
    cpSync(dir.replace(slug, source), tempDir, { recursive: true });

    try {
      // remove starter project's .git traclomg
      rmdirSync(join(tempDir, `.git`), { recursive: true });
    } catch (e) {
      // this can't fail.
    }

    // If this is a starter, we don't want the settings.json file
    if (isStarter) {
      try {
        unlinkSync(join(tempDir, `.container`, `settings.json`));
      } catch (e) {
        // this should never happen, but *shrug*
      }
    }

    // If it's *not* a starter, strip the .data dir!
    else {
      try {
        unlinkSync(join(tempDir, `.data`), { recursive: true });
      } catch (e) {
        // we don't care if there was no .data dir
      }
    }

    rmdirSync(dir, { recursive: true });
    renameSync(tempDir, dir);
    addGitTracking(dir, `initial remix`);
  }
}

/**
 * ...docs go here...
 */
export async function createProjectDownload(req, res, next) {
  const { dirData, lookups, user } = res.locals;
  const { files } = dirData;
  const { project } = lookups;
  const { slug } = project;

  const zipDir = resolve(join(CONTENT_DIR, `__archives`));
  if (!pathExists(zipDir)) mkdirSync(zipDir);

  const dest = `${resolve(zipDir, slug)}.zip`;
  res.locals.zipFile = dest;

  const output = createWriteStream(dest);
  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.pipe(output);

  output.on("close", () => next());
  archive.on("error", (err) => next(err));

  // Additional "these should never be in a zip file"
  const prefixes = [`node_modules/`];

  // And additional "these should be added back in"
  if (getAccessFor(user, project) >= OWNER) {
    files.push(
      ...globSync(`.git/**/*`, {
        cwd: join(CONTENT_DIR, slug),
      }),
    );
  }

  // Then we build our zip file.
  files.forEach((file) => {
    if (prefixes.some((p) => file.startsWith(p))) return;
    const path = resolve(CONTENT_DIR, slug, file);
    try {
      if (lstatSync(path).isDirectory()) {
        // Don't include dir entries
        // TODO: This means we "lose" empty dirs
        return;
      }
      // console.log(file);
      const stream = createReadStream(path);
      archive.append(stream, { name: `${slug}/${file}` });
    } catch (e) {
      // This file is not getting added.
    }
  });

  // console.log(`finalizing ${slug}.zip`)
  archive.finalize();
}

/**
 * ...docs go here...
 */
export async function deleteProject(req, res, next) {
  const { user, lookups, adminCall } = res.locals;
  const { project } = lookups;
  const { slug } = project;

  deleteProjectForUser(user, project, adminCall);

  console.log(`Cleaning up Caddyfile`);
  removeCaddyEntry(project);

  console.log(`Cleaning up ${slug} container and image`);
  deleteContainerAndImage(project);

  console.log(`Removing ${slug} from the filesystem`);
  rmSync(join(CONTENT_DIR, slug), {
    recursive: true,
    force: true,
  });

  next();
}

/**
 * get project settings for use in the website's "edit" fragment.
 * Note that this is the project's properties + the project
 * settings, flattened as one object.
 */
export function getProjectSettings(req, res, next) {
  const { project } = res.locals.lookups;
  res.locals.settings = {
    ...project,
    ...project.settings,
  };
  next();
}

/**
 * ...docs go here...
 */
export async function loadProject(req, res, next) {
  const { user, lookups } = res.locals;
  const { project } = lookups;
  const { slug, settings } = project;
  const dir = join(CONTENT_DIR, slug);
  const isStarter = isStarterProject(project);

  if (!pathExists(dir) && !isStarter) {
    // not sure this is possible, but...
    return next(new Error(`No such project`));
  }

  let suspended = false;

  if (!isStarter) {
    // ensure there's a git dir, just in case someone
    // writes their own "delete the .git dir" code...
    if (!pathExists(`${dir}/.git`)) {
      console.log(`adding git tracking for ${dir}`);
      addGitTracking(dir, `initial commit`);
    }

    const suspensions = getProjectSuspensions(project);
    if (suspensions.length) {
      suspended = true;
      if (!user?.admin)
        return next(
          new Error(
            `This project has been suspended (${suspensions.map((s) => `"${s.reason}"`).join(`, `)})`,
          ),
        );
    }

    if (projectSuspendedThroughOwner(project)) {
      suspended = true;
      if (!user?.admin) {
        return next(
          new Error(
            `This project has been suspended because its project owner is suspended`,
          ),
        );
      } else {
        console.log(`Suspended project load by admin`);
      }
    }

    // ensure git knows who we are.
    setupGit(dir, slug);
  }

  // Then get a container running
  if (!suspended) {
    const { app_type } = settings;
    const staticType = app_type === null || app_type === `static`;
    const inEditor = req.originalUrl?.startsWith(`/v1/projects/edit/`);
    const mayEdit = isStarter ? false : getAccessFor(user, project) >= MEMBER;
    const noStatic = inEditor && user && mayEdit;
    if (!staticType || noStatic) {
      stopStaticServer(project);
      await runContainer(project);
    } else {
      runStaticServer(project);
    }
  }

  // is this a logged in user?
  if (user && !isStarter) {
    // if this their project?
    const a = getAccessFor(user, project);
    if (a >= MEMBER) {
      res.locals.projectMember = true;
      if (a >= OWNER) {
        res.locals.projectOwner = true;
      }
    }
  }

  res.locals.starter = isStarter;
  res.locals.projectSettings = settings;
  res.locals.viewFile = req.query?.view ?? project.settings.default_file;

  next();
}

/**
 * ...docs go here...
 */
export async function loadProjectHistory(req, res, next) {
  const { slug } = res.locals.lookups.project;
  const { commit } = req.params;
  if (commit) {
    const cmd = `git show ${commit}`;
    const output = await execPromise(cmd, {
      cwd: join(CONTENT_DIR, slug),
    });
    res.locals.history = {
      commit: output,
    };
  } else {
    const cmd = `git log --no-abbrev-commit --pretty=format:"%H%x09%ad%x09%s"`;
    const output = await execPromise(cmd, {
      cwd: join(CONTENT_DIR, slug),
    });
    const parsed = output.split(`\n`).map((line) => {
      let [hash, timestamp, reason] = line.split(`\t`).map((e) => e.trim());
      reason = reason.replace(/^['"]?/, ``).replace(/['"]?$/, ``);
      return { hash, timestamp, reason };
    });
    res.locals.history = parsed;
  }
  next();
}

/**
 * Get a project's console logs
 */
export async function getProjectLogs(req, res, next) {
  const { project } = res.locals.lookups;
  const { slug } = project;
  const { since } = req.params;
  const binding = portBindings[slug];
  if (binding && !binding.serverProcess) {
    res.locals.logs = getContainerLogs(project, since);
  }
  next();
}

/**
 * ...docs go here...
 */
export async function remixProject(req, res, next) {
  const { user, lookups } = res.locals;

  // Just to make sure
  if (!user.enabled_at) {
    return next(new Error(`Your account has not been activated yet`));
  }

  const { project } = lookups;
  const isStarter = isStarterProject(project);
  const newProjectName = req?.params?.newname ?? `${user.name}-${project.slug}`;

  try {
    // Just in case our users are lazy and don't rename remixes,
    // let's make sure we generate a unique name using the age-old
    // solution of "slapping a number at the end":
    let suffix;
    let newSlug = slugify(newProjectName);
    if (existsSync(join(CONTENT_DIR, newSlug))) {
      suffix = 2;
      const nextFreeDir = slugify(`${newSlug}-${suffix}`);
      while (existsSync(join(CONTENT_DIR, nextFreeDir))) {
        suffix += 1;
      }
    }
    if (suffix) newSlug = `${newSlug}-${suffix}`;

    // Now that we have a valid slug, let's create a new project.
    const newProject = (res.locals.newProject = createProjectForUser(
      user,
      newSlug,
    ));

    const newProjectSlug = (res.locals.newProjectSlug = newProject.slug);

    try {
      cloneProject(project, newProjectSlug, isStarter);
    } catch (e) {
      // If something went wrong, undo our project creation
      console.error(`Could not create project with slug ${newSlug}!`, e);
      deleteProject(newProject.id);
      return next(new Error(`could not create project`));
    }

    recordProjectRemix(project, newProject);

    const s = copyProjectSettings(project, newProject);
    const containerDir = join(CONTENT_DIR, newProjectSlug, `.container`);
    const runScript = join(containerDir, `run.sh`);

    // shell scripts *must* use unix line endings.
    writeFileSync(runScript, s.run_script.replace(/\r\n/g, `\n`));

    next();
  } catch (e) {
    console.error(e);
    return next(e);
  }
}

/**
 * ...docs go here...
 */
export async function restartProject(req, res, next) {
  const { project } = res.locals.lookups;
  if (project.settings.app_type === `static`) {
    // do nothing. Static servers don't need restarting.
  } else {
    await restartContainer(project);
  }
  next();
}

/**
 * ...docs go here...
 */
export function startProject(req, res, next) {
  const { WEB_EDITOR_APP_SECRET } = process.env;

  if (req.params.secret !== WEB_EDITOR_APP_SECRET) {
    return next(new Error(`Not found`));
  }

  // Is this project allowed to start?
  const { project } = res.locals.lookups;
  if (isProjectSuspended(project)) {
    return next(new Error(`suspended`));
  }

  runProject(project);

  next();
}

/**
 * ...docs go here...
 * @returns
 */
export async function updateProjectSettings(req, res, next) {
  const { lookups } = res.locals;
  const { project } = lookups;
  const { slug: projectSlug, settings } = project;
  const { run_script, env_vars, app_type: oldAppType } = settings;

  // Set up the new settings object, using the
  // original project settings as fallback values:
  const newSettings = Object.assign(
    {},
    settings,
    Object.fromEntries(Object.entries(req.body).map(([k, v]) => [k, v.trim()])),
  );

  const newName = newSettings.name ?? project.name;
  const newSlug = slugify(newName);
  const newDir = join(CONTENT_DIR, newSlug);
  const containerDir = join(newDir, `.container`);
  const app_type = newSettings.app_type ?? oldAppType;

  if (projectSlug !== newSlug) {
    if (pathExists(newDir)) {
      return next(
        new Error(
          "Cannot rename project (someone else already owns this project name!)",
        ),
      );
    }
  }

  // no run script? See if there's a run.sh and copy that.
  if (newSettings.run_script.trim() === ``) {
    const runScriptPath = join(containerDir, `run.sh`);
    if (existsSync(runScriptPath)) {
      const data = readFileSync(runScriptPath).toString();
      newSettings.run_script = data.replace(/\r\n/g, `\n`);
    }
  }

  try {
    updateSettingsForProject(project, newSettings);

    let containerChange = false;

    if (projectSlug !== newSlug) {
      containerChange = true;
      renameSync(join(CONTENT_DIR, projectSlug), newDir);
      renameContainer(projectSlug, newSlug);
      console.log(`rebinding res.locals.projectSlug to ${newSlug}`);
    }

    res.locals.projectSlug = newSlug;

    // Do we need to update our container files? (there's nothing
    // to update wrt a static server, it's static content).
    if (app_type === `docker`) {
      if (run_script !== newSettings.run_script) {
        containerChange = true;
        writeFileSync(
          join(containerDir, `run.sh`),
          // shell scripts *must* use unix line endings.
          newSettings.run_script.replace(/\r\n/g, `\n`),
        );
      } else if (env_vars !== newSettings.env_vars) {
        containerChange = true;
        writeFileSync(join(containerDir, `.env`), newSettings.env_vars);
      }
    }

    if (containerChange) {
      const oldProject = { slug: projectSlug };
      if (oldAppType === `docker`) {
        stopContainer(oldProject);
        await runContainer(project);
      } else if (oldAppType === `static`) {
        stopStaticServer(oldProject);
        await runStaticServer(project);
      }
    }

    next();
  } catch (e) {
    next(e);
  }
}
