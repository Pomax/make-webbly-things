import {
  runContainer,
  runStaticServer,
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
// several data-writing functions.
(function enhanceProjectModel() {
  function runOp(operation, fields) {
    // ensure the slug is always correct
    if (fields.name) fields.slug = slugify(fields.name);
    // and if this is a project-with-settings,
    // temporarily strip that so we only insert
    // data that belongs in the project table.
    const s = fields.settings;
    delete fields.settings;
    const result = operation(fields);
    fields.settings = s;
    return result;
  }

  [`insert`, `save`, `delete`, `findAll`].forEach((fn) => {
    const original = Project[fn].bind(Project);
    Project[fn] = (fields) => runOp(original, fields);
  });
})();

import { getUser, userIsAdmin, getUserSuspensions } from "./user.js";
import { portBindings } from "../caddy/caddy.js";
import {
  dockerDueToEdit,
  getTimingDiffInMinutes,
} from "../docker/sleep-check.js";
import { scheduleScreenShot } from "../screenshots/screenshot.js";

export function getMostRecentProjects(projectCount) {
  const query = `
    select
      *,
      projects.id as id
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
  `;
  return runQuery(query);
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
  const s = ProjectSettings.create({ project_id: p.id });
  p.settings = s;
  return p;
}

/**
 * ...docs go here...
 */
export function deleteProjectForUser(user, project, adminCall) {
  if (!adminCall) {
    if (!user) {
      throw new Error(`No user given`);
    }
    const a = Access.find({ project_id: project.id, user_id: user.id });
    if (!a || a.access_level < OWNER) {
      throw new Error(`Not yours, mate`);
    }
  }
  const { name } = project;
  // console.log(`Deleting access rules for project ${name}...`);
  const rules = Access.findAll({ project_id: project.id });
  for (const r of rules) Access.delete(r);
  // console.log(`Deleting project ${name}...`);
  Project.delete(project);
  // console.log(`Deletion complete.`);
  return name;
}

/**
 * ...docs go here...
 */
export function getAccessFor(user, project) {
  if (!user) return UNKNOWN_USER;
  if (!user.enabled_at) return NOT_ACTIVATED;
  const admin = user.admin || userIsAdmin(user);
  if (admin) return ADMIN;
  console.debug({ project_id: project.id, user_id: user.id });
  const a = Access.find({ project_id: project.id, user_id: user.id });
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
export function getOwnedProjectsForUser(user) {
  const access = Access.findAll({ user_id: user.id });
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
      .map(([k, v]) => [k.trim(), v.trim()]),
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
export function getProjectListForUser(user) {
  const projects = Access.findAll({ user_id: user.id });
  return projects
    .map((p) => Project.find({ id: p.project_id }))
    .sort((a, b) => {
      return a.updated_at < b.updated_at ? 1 : -1;
    });
}

/**
 * Get the list of users with owner access to this project
 */
export function getProjectOwners(project) {
  return Access.findAll({ project_id: project.id }).map(({ user_id }) =>
    User.find({ id: user_id }),
  );
}

/**
 * ...docs go here...
 */
export function getProjectRemixChain(project) {
  let id = project.id;
  const chain = [id];
  while (project) {
    const r = Remix.find({ project_id: project.id });
    if (!r) break;
    id = r.original_id;
    chain.unshift(id);
    project = getProject(id);
  }
  return chain;
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
  return (
    ProjectSuspension.findAll({ project_id: project.id }).filter(
      (s) => !s.invalidated_at,
    ).length > 0
  );
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
    const s = getUserSuspensions(u);
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
 * https://github.com/Pomax/make-webbly-things/issues/108
 */
export async function runProject(project) {
  const { settings } = project;
  const lastUpdate = Date.parse(`${project.updated_at} +0000`);
  const diff = getTimingDiffInMinutes(lastUpdate);
  const noStatic = diff < dockerDueToEdit;

  if (settings.app_type === `docker` || noStatic) {
    return runContainer(project);
  } else {
    return runStaticServer(project);
  }
}

/**
 * ...docs go here...
 */
export async function stopProject(project) {
  const { slug } = project;
  const binding = portBindings[slug];
  if (binding) {
    if (binding.serverProcess) {
      return stopStaticServer(project);
    } else {
      return stopContainer(project);
    }
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
    return ProjectSuspension.create({ project_id: project.id, reason, notes });
  } catch (e) {
    console.error(e);
    console.log({ project, reason, notes });
  }
}

/**
 * ...docs go here...
 */
export async function touch(project) {
  // run touch() with a fresh record!
  const p = getProject(project.id, false);
  Project.save(p);
  if (!portBindings[p.slug]) return runProject(project);
  scheduleScreenShot(project);
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
  let { name, description, ...containerSettings } = settings;
  name ??= project.name;
  description ??= project.description;

  project.name = name;
  project.slug = slugify(name);
  project.description = description;
  Project.save(project);

  let s = project.settings;
  if (!s) {
    s = ProjectSettings.find({ project_id: project.id });
    project.settings = s;
  }
  Object.assign(s, containerSettings);
  ProjectSettings.save(s);
  return s;
}
