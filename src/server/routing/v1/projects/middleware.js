import { execSync } from "node:child_process";
import { join, resolve } from "node:path";

import {
  cpSync,
  createReadStream,
  createWriteStream,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import archiver from "archiver";

import {
  CONTENT_DIR,
  execPromise,
  pathExists,
  makeSafeProjectName,
  setupGit,
} from "../../../../helpers.js";

import {
  checkContainerHealth as dockerHealthCheck,
  deleteContainerAndImage,
  renameContainer,
  restartContainer as restartDockerContainer,
  runContainer,
  runStaticSite,
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
  loadSettingsForProject,
  projectSuspendedThroughOwner,
  recordProjectRemix,
  updateSettingsForProject,
} from "../../../database/index.js";

import { portBindings, removeCaddyEntry } from "../../../caddy/caddy.js";
import {
  dockerDueToEdit,
  getTimingDiffInMinutes,
} from "../../../docker/sleep-check.js";
import { runProject } from "../../../database/project.js";

/**
 * ...docs go here...
 */
export async function checkProjectHealth(req, res, next) {
  const { project } = res.locals.lookups;
  const settings = loadSettingsForProject(project.id);
  if (settings.app_type === `static`) {
    try {
      const { port } = portBindings[project.name];
      await fetch(`http://localhost:${port}`);
      res.locals.healthStatus = `ready`;
    } catch (e) {
      res.locals.healthStatus = `failed`;
    }
  } else {
    res.locals.healthStatus = dockerHealthCheck(project.name);
  }
  next();
}

/**
 * ...docs go here...
 * @param {*} source
 * @param {*} projectName
 */
function cloneProject(source, projectName, isStarter) {
  const dir = join(CONTENT_DIR, projectName);

  if (isStarter) {
    source = `__starter_projects/${source || `empty`}`;
  }

  if (!pathExists(dir)) {
    mkdirSync(dir);
    cpSync(dir.replace(projectName, source), dir, { recursive: true });
    try {
      unlinkSync(join(dir, `.git`), { recursive: true });
    } catch (e) {
      // this can't fail.
    }
    try {
      unlinkSync(join(dir, `.container`, `.env`));
    } catch (e) {
      // we don't care if .env didn't exist =)
    }
    try {
      unlinkSync(join(dir, `.data`), { recursive: true });
    } catch (e) {
      // we also don't care if there was no .data dir
    }
  }
}

/**
 * ...docs go here...
 */
export async function createProjectDownload(req, res, next) {
  const { dir, lookups } = res.locals;
  const projectName = lookups.project.name;
  const zipDir = resolve(join(CONTENT_DIR, `__archives`));
  if (!pathExists(zipDir)) mkdirSync(zipDir);
  const dest = resolve(zipDir, projectName) + `.zip`;
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
    const path = resolve(CONTENT_DIR, projectName, file);
    if (lstatSync(path).isDirectory()) return;
    // console.log(file);
    const stream = createReadStream(path);
    archive.append(stream, { name: `${projectName}/${file}` });
  });

  // console.log(`finalizing ${projectName}.zip`)
  archive.finalize();
}

/**
 * ...docs go here...
 */
export async function deleteProject(req, res, next) {
  const { user, lookups, adminCall } = res.locals;
  const userName = user.name;
  const projectName = lookups.project.name;

  deleteProjectForUser(userName, projectName, adminCall);

  console.log(`Cleaning up Caddyfile`);
  removeCaddyEntry(projectName);

  console.log(`Cleaning up ${projectName} container and image`);
  deleteContainerAndImage(projectName);

  console.log(`Removing ${projectName} from the filesystem`);
  rmSync(join(CONTENT_DIR, projectName), {
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
  const { id: projectId, name: projectName } = project;
  const dir = join(CONTENT_DIR, projectName);

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

  const suspensions = getProjectSuspensions(projectName);
  if (suspensions.length) {
    suspended = true;
    if (!user?.admin)
      return next(
        new Error(
          `This project has been suspended (${suspensions.map((s) => `"${s.reason}"`).join(`, `)})`
        )
      );
  }

  if (projectSuspendedThroughOwner(projectName)) {
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
  setupGit(dir, projectName);

  // Then get a container running
  if (!suspended) {
    const { app_type } = loadSettingsForProject(projectId)?.settings ?? {};
    const staticType = app_type === null || app_type === `static`;
    const inEditor = req.originalUrl.startsWith(`/v1/projects/edit/`);
    const mayEdit = getAccessFor(user?.name, project.name) >= MEMBER;
    const noStatic = inEditor && user && mayEdit;
    if (!staticType || noStatic) {
      stopStaticServer(projectName);
      await runContainer(projectName);
    } else {
      runStaticSite(projectName);
    }
  }

  // is this a logged in user?
  if (res.locals.user) {
    // if this their project?
    const a = getAccessFor(res.locals.user.name, projectName);
    if (a >= MEMBER) {
      res.locals.projectMember = true;
      if (a === OWNER) {
        res.locals.projectOwner = true;
      }
    }
  }

  const settings = loadSettingsForProject(projectId);
  res.locals.projectSettings = settings;
  res.locals.viewFile = req.query.view;

  next();
}

/**
 * ...docs go here...
 */
export function getProjectSettings(req, res, next) {
  const projectId = res.locals.lookups.project.id;
  res.locals.settings = loadSettingsForProject(projectId);
  next();
}

/**
 * ...docs go here...
 */
export async function loadProjectHistory(req, res, next) {
  const projectName = res.locals.lookups.project.name;
  const { commit } = req.params;
  if (commit) {
    const cmd = `git show ${commit}`;
    const output = await execPromise(cmd, {
      cwd: join(CONTENT_DIR, projectName),
    });
    res.locals.history = {
      commit: output,
    };
  } else {
    const cmd = `git log --no-abbrev-commit --pretty=format:"%H%x09%ad%x09%s"`;
    const output = await execPromise(cmd, {
      cwd: join(CONTENT_DIR, projectName),
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
  const newName = makeSafeProjectName(
    req.params.newname ?? `${user.name}-${project.name}`
  );
  const newProjectName = (res.locals.newProjectName = newName);
  const isStarter = isStarterProject(project.id);

  cloneProject(project.name, newProjectName, isStarter);

  try {
    const { project: newProject } = createProjectForUser(
      user.name,
      newProjectName
    );
    recordProjectRemix(project.id, newProject.id);
    const s = copyProjectSettings(project.id, newProject.id);
    const containerDir = join(CONTENT_DIR, newProjectName, `.container`);
    const runScript = join(containerDir, `run.sh`);
    writeFileSync(runScript, s.run_script);
    if (isStarter) rmSync(join(containerDir, `settings.json`));
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
  const settings = loadSettingsForProject(project.id);
  if (settings.app_type === `static`) {
    // do nothing. Static servers don't need restarting.
  } else {
    restartDockerContainer(project.name);
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
  if (isProjectSuspended(project.id)) {
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
  const { id: projectId, name: projectName } = project;
  const { run_script, env_vars } = settings;

  const newSettings = Object.fromEntries(
    Object.entries(req.body).map(([k, v]) => [k, v.trim()])
  );

  const newName = newSettings.name;
  const newDir = join(CONTENT_DIR, newName);
  const containerDir = join(newDir, `.container`);
  const app_type = newSettings.app_type ?? settings.app_type;

  if (projectName !== newName) {
    if (pathExists(newDir)) {
      return next(new Error("Cannot rename project"));
    }
  }

  // no run script? See if there's a run.sh and copy that.
  if (newSettings.run_script.trim() === ``) {
    try {
      const data = readFileSync(join(containerDir, `run.sh`)).toString();
      newSettings.run_script = data;
    } catch (e) {
      // console.error(e);
    }
  }

  try {
    updateSettingsForProject(projectId, newSettings);

    if (projectName !== newName) {
      renameSync(join(CONTENT_DIR, projectName), newDir);
      renameContainer(projectName, newName);
      console.log(`rebinding res.locals.projectName to ${newName}`);
    }

    res.locals.projectName = newName;

    // Do we need to update our container files? (there's nothing
    // to update wrt a static server, it's static content).
    if (app_type === `docker`) {
      let containerChange = false;

      if (run_script !== newSettings.run_script) {
        containerChange = true;
        writeFileSync(join(containerDir, `run.sh`), newSettings.run_script);
      } else if (env_vars !== newSettings.env_vars) {
        containerChange = true;
        writeFileSync(join(containerDir, `.env`), newSettings.env_vars);
      }

      if (containerChange) {
        await restartDockerContainer(projectName, true);
      }
    }

    next();
  } catch (e) {
    next(e);
  }
}
