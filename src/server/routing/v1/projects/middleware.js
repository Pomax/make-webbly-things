import { execSync } from "node:child_process";
import { join, resolve } from "node:path";

import {
  cpSync,
  createReadStream,
  createWriteStream,
  existsSync,
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
  renameContainer,
  restartContainer as restartDockerContainer,
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

/**
 * ...docs go here...
 */
export async function checkProjectHealth(req, res, next) {
  const { project } = res.locals.lookups;
  if (project.settings.app_type === `static`) {
    try {
      const { port } = portBindings[project.slug];
      await fetch(`http://localhost:${port}`);
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
  const source = project.slug;
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
  }
}

/**
 * ...docs go here...
 */
export async function createProjectDownload(req, res, next) {
  const { dir, lookups } = res.locals;
  const { slug } = lookups.project;

  const zipDir = resolve(join(CONTENT_DIR, `__archives`));
  if (!pathExists(zipDir)) mkdirSync(zipDir);

  const dest = resolve(zipDir, slug) + `.zip`;
  res.locals.zipFile = dest;

  const output = createWriteStream(dest);
  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.pipe(output);

  output.on("close", () => next());
  archive.on("error", (err) => next(err));

  // Additional "these should never be in a zip file"
  const prefixes = [`node_modules/`];

  dir.forEach((file) => {
    if (prefixes.some((p) => file.startsWith(p))) return;
    const path = resolve(CONTENT_DIR, slug, file);
    if (lstatSync(path).isDirectory()) return;
    // console.log(file);
    const stream = createReadStream(path);
    archive.append(stream, { name: `${slug}/${file}` });
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
 * ...docs go here...
 */
export async function loadProject(req, res, next) {
  const { user, lookups } = res.locals;
  const { project } = lookups;
  const { slug, settings } = project;
  const dir = join(CONTENT_DIR, slug);

  if (!pathExists(dir)) {
    // not sure this is possible, but...
    return next(new Error(`No such project`));
  }

  // ensure there's a git dir
  if (!pathExists(`${dir}/.git`)) {
    console.log(`adding git tracking for ${dir}`);
    execSync(`cd ${dir} && git init && cd ..`);
  }

  let suspended = false;

  const suspensions = getProjectSuspensions(project);
  if (suspensions.length) {
    suspended = true;
    if (!user?.admin)
      return next(
        new Error(
          `This project has been suspended (${suspensions.map((s) => `"${s.reason}"`).join(`, `)})`
        )
      );
  }

  if (projectSuspendedThroughOwner(project)) {
    suspended = true;
    if (!user?.admin) {
      return next(
        new Error(
          `This project has been suspended because its project owner is suspended`
        )
      );
    } else {
      console.log(`Suspended project load by admin`);
    }
  }

  // ensure git knows who we are.
  setupGit(dir, slug);

  // Then get a container running
  if (!suspended) {
    const { app_type } = settings;
    const staticType = app_type === null || app_type === `static`;
    const inEditor = req.originalUrl.startsWith(`/v1/projects/edit/`);
    const mayEdit = getAccessFor(user, project) >= MEMBER;
    const noStatic = inEditor && user && mayEdit;
    if (!staticType || noStatic) {
      stopStaticServer(project);
      await runContainer(project);
    } else {
      runStaticServer(project);
    }
  }

  // is this a logged in user?
  if (user) {
    // if this their project?
    const a = getAccessFor(user, project);
    if (a >= MEMBER) {
      res.locals.projectMember = true;
      if (a >= OWNER) {
        res.locals.projectOwner = true;
      }
    }
  }

  res.locals.projectSettings = settings;
  res.locals.viewFile = req.query.view ?? project.settings.default_file;

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
  const newProjectName = req.params.newname ?? `${user.name}-${project.slug}`;

  try {
    const newProject = createProjectForUser(user, newProjectName);
    const newProjectSlug = (res.locals.newProjectSlug = newProject.slug);

    cloneProject(project, newProjectSlug, isStarter);
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
export function restartContainer(req, res, next) {
  const { project } = res.locals.lookups;
  if (project.settings.app_type === `static`) {
    // do nothing. Static servers don't need restarting.
  } else {
    restartDockerContainer(project);
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
  const { lookups, settings } = res.locals;
  const { project } = lookups;
  const { slug: projectSlug } = project;
  const { run_script, env_vars } = settings;

  const newSettings = Object.fromEntries(
    Object.entries(req.body).map(([k, v]) => [k, v.trim()])
  );

  const newName = newSettings.name;
  const newSlug = slugify(newName);
  const newDir = join(CONTENT_DIR, newSlug);
  const containerDir = join(newDir, `.container`);
  const app_type = newSettings.app_type ?? settings.app_type;

  if (projectSlug !== newSlug) {
    if (pathExists(newDir)) {
      return next(
        new Error(
          "Cannot rename project (someone else already owns this project name!)"
        )
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
          newSettings.run_script.replace(/\r\n/g, `\n`)
        );
      } else if (env_vars !== newSettings.env_vars) {
        containerChange = true;
        writeFileSync(join(containerDir, `.env`), newSettings.env_vars);
      }
    }

    if (containerChange) {
      stopContainer(projectSlug);
      await runContainer(project);
    }

    next();
  } catch (e) {
    next(e);
  }
}
