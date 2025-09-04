import { join } from "node:path";

import {
  runContainer,
  runStaticSite,
  stopContainer,
  stopStaticServer,
} from "../docker/docker-helpers.js";

import {
  runQuery,
  Models,
  UNKNOWN_USER,
  NOT_ACTIVATED,
  ADMIN,
  OWNER,
  EDITOR,
  MEMBER,
} from "./models.js";

import { slugify } from "../../helpers.js";

import dotenv from "@dotenvx/dotenvx";
const envPath = join(import.meta.dirname, `../../../.env`);
dotenv.config({ path: envPath, quiet: true });

export { UNKNOWN_USER, NOT_ACTIVATED, OWNER, EDITOR, MEMBER };

const {
  Access,
  Project,
  ProjectSettings,
  ProjectSuspension,
  Remix,
  StarterProject,
  User,
} = Models;

// Ensure that the project slug is always up to date
// based on the project name, which means updating
// the insert and save functions. Everything else
// falls through to those (including create):

const ogInsert = Project.insert.bind(Project);
Project.insert = (fields) => {
  if (fields.name) {
    fields.slug = slugify(fields.name);
  }
  ogInsert(fields);
};

const ogSave = Project.save.bind(Project);
Project.save = (fields) => {
  if (fields.name) {
    fields.slug = slugify(fields.name);
  }
  ogSave(fields);
};

import { getUser, getUserAdminFlag, getUserSuspensions } from "./user.js";
import { portBindings } from "../caddy/caddy.js";
import {
  dockerDueToEdit,
  getTimingDiffInMinutes,
} from "../docker/sleep-check.js";

export function getMostRecentProjects(projectCount) {
  return runQuery(`
    select
      *
    from
      projects 
    left join
      starter_projects as strt
      on
        strt.project_id=projects.id
    left join
      suspended_projects as sus
      on
        sus.project_id=projects.id
    where
      strt.project_id is null
    and
      sus.project_id is null
    order by
      updated_at DESC,
      created_at DESC
    limit ${projectCount}
  `);
}

/**
 * Copy project settings from one project to another,
 * making sure NOT to copy the project id or environment
 * variables.
 */
export function copyProjectSettings(source, target) {
  // Copy over the project description
  target.description = source.description;
  Project.save(target);
  // And create a new project settings entry
  const { project_id, env_vars, ...settings } = source.settings;
  target = target.settings;
  Object.assign(target, settings);
  ProjectSettings.save(target);
  return target;
}

/**
 * Create a new project record, tied to a user account,
 * based on "we only know the intended project name"
 * (and then subsequent code might assign content to
 * this new project. That's not this function's concern)
 */
export function createProjectForUser(user, projectName) {
  const p = Project.create({ name: projectName });
  Access.create({ project_id: p.id, user_id: user.id });
  ProjectSettings.create({ project_id: p.id });
  return { user: u, project: p };
}

/**
 * ...docs go here...
 */
export function deleteProjectForUser(user, project, adminCall) {
  const a = Access.find({ project_id: project.id, user_id: user.id });

  // secondary layer of protection:
  if (a.access_level < OWNER && !adminCall) throw new Error(`Not yours, mate`);

  const { name } = project;
  console.log(`Deleting access rules for project ${name}...`);
  const rules = Access.findAll({ project_id: project.id });
  for (const r of rules) Access.delete(r);

  console.log(`Deleting project ${name}...`);
  Project.delete(project);

  console.log(`Deletion complete.`);
  return name;
}

/**
 * ...docs go here...
 */
export function getAccessFor(user, project) {
  if (!user) return UNKNOWN_USER;
  if (!user.enabled_at) return NOT_ACTIVATED;
  const admin = getUserAdminFlag(user.name);
  if (admin) return ADMIN;
  const a = Access.find({ project_id: project.id, user_id: u.id });
  return a ? a.access_level : UNKNOWN_USER;
}

/**
 * ...docs go here...
 */
export function getAllProjects(omitStarters = true) {
  const projectList = {};

  const projects = Project.all(`name`);
  projects.forEach((p) => {
    if (!p) return;
    if (omitStarters && isStarterProject(p)) return;
    p.settings = ProjectSettings.find({ project_id: p.id });
    p.suspensions = [];
    projectList[p.id] = p;
  });

  const suspensions = ProjectSuspension.all(`project_id`);
  suspensions.forEach((s) => {
    if (!s) return;
    projectList[s.project_id].suspensions.push(s);
    if (!s.invalidated_at) {
      projectList[s.project_id].activeSuspensions = true;
    }
  });

  return Object.values(projectList);
}

/**
 * ...docs go here...
 */
export function getOwnedProjectsForUser(userNameOrId) {
  const u = getUser(userNameOrId);
  const access = Access.findAll({ user_id: u.id });
  return access
    .filter((a) => a.access_level >= OWNER)
    .map((a) => getProject(a.project_id));
}

/**
 * ...docs go here...
 */
export function getProject(slugOrId, withSettings = true) {
  let p;
  if (typeof slugOrId === `number`) {
    p = Project.find({ id: slugOrId });
  } else {
    p = Project.find({ slug: slugOrId });
  }
  if (!p) throw new Error(`Project ${slugOrId} not found`);
  if (withSettings) {
    const s = ProjectSettings.find({ project_id: p.id });
    p.settings = s;
  }
  return p;
}

/**
 * ...docs go here...
 */
export function getProjectEnvironmentVariables(project) {
  const { env_vars } = project.settings;
  if (!env_vars) return [];
  return Object.fromEntries(
    env_vars
      .split(`\n`)
      .filter((v) => v.includes(`=`))
      .map((v) => v.trim().split(`=`))
      .map(([k, v]) => [k.trim(), v.trim()])
  );
}

/**
 * ...docs go here...
 */
export function getProjectSuspensions(project, includeOld = false) {
  const s = ProjectSuspension.findAll({ project_id: project.id });
  if (includeOld) return s;
  return s.filter((s) => !s.invalidated_at);
}

/**
 * ...docs go here...
 */
export function getProjectListForUser(userNameOrId) {
  const u = getUser(userNameOrId);
  const projects = Access.findAll({ user_id: u.id });
  return projects.map((p) => Project.find({ id: p.project_id }));
}

/**
 * ...docs go here...
 */
export function getStarterProjects() {
  // Would a JOIN be faster? Probably. Are we running at a
  // scale where that matters? Hopefully never =)
  return StarterProject.all().map((s) => Project.find({ id: s.project_id }));
}

/**
 * ...docs go here...
 */
export function isProjectSuspended(project) {
  return !!ProjectSuspension.find({ project_id: project.id });
}

/**
 * ...docs go here...
 */
export function isStarterProject(project) {
  return !!StarterProject.find({ project_id: project.id });
}

/**
 * ...docs go here...
 */
export function projectSuspendedThroughOwner(project) {
  const access = Access.findAll({ project_id: project.id });
  return access.some((a) => {
    if (a.access_level < OWNER) return false;
    const u = getUser(a.user_id);
    const s = getUserSuspensions(u.id);
    if (s.length) return true;
    return false;
  });
}

/**
 * ...docs go here...
 */
export function recordProjectRemix(original, newProject) {
  Remix.create({ original_id: original.id, project_id: newProject.id });
}

/**
 * Is this a static project, or does it need a container?
 * Or, even if it's a static project, was there a project
 * edit that warrants us firing up a docker container
 * for now anyway?
 *
 * TODO: move this to where it belongs.
 */
export function runProject(project) {
  const { settings } = project;
  const lastUpdate = Date.parse(project.updated_at + ` +0000`);
  const diff = getTimingDiffInMinutes(lastUpdate);
  const noStatic = diff < dockerDueToEdit;

  if (settings.app_type === `docker` || noStatic) {
    runContainer(project);
  } else {
    runStaticSite(project);
  }
}

/**
 * ...docs go here...
 */
export function suspendProject(project, reason, notes = ``) {
  if (!reason) throw new Error(`Cannot suspend project without a reason`);
  try {
    if (project.settings.app_type === `static`) {
      stopStaticServer(project);
    } else {
      stopContainer(project);
    }
    ProjectSuspension.create({ project_id: project.id, reason, notes });
  } catch (e) {
    console.error(e);
    console.log(u, reason, notes);
  }
}

/**
 * ...docs go here...
 */
export function touch(project) {
  const p = getProject(project.id, false); // don't include settings here!
  if (p) Project.save(p);
  if (!portBindings[p.name]) runProject(p);
}

/**
 * ...docs go here...
 */
export function unsuspendProject(suspensionId) {
  const s = ProjectSuspension.find({ id: suspensionId });
  if (!s) throw new Error(`Suspension not found`);
  s.invalidated_at = new Date().toISOString();
  ProjectSuspension.save(s);
}

/**
 * ...docs go here...
 */
export function updateSettingsForProject(project, settings) {
  const { name, description, ...containerSettings } = settings;

  project.name = name;
  project.slug = slugify(name);
  project.description = description;
  Project.save(project);

  const s = project.settings;
  Object.assign(s, containerSettings);
  ProjectSettings.save(s);
}
