import { stopContainer, stopStaticServer } from "../docker/docker-helpers.js";

import {
  runQuery,
  Models,
  UNKNOWN_USER,
  NOT_ACTIVATED,
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

import { getUser, getUserSuspensions } from "./user.js";

export function getMostRecentProjects(projectCount) {
  return runQuery(`
    select *
    from projects 
    left join starter_projects as strt on strt.project_id=projects.id
    left join suspended_projects as sus on sus.project_id=projects.id
    where strt.project_id is null AND sus.project_id is null
    order by updated_at DESC, created_at DESC
    limit ${projectCount}
  `);
}

/**
 * ...docs go here...
 */
export function copyProjectSettings(originalId, projectId) {
  // Copy over the project description
  let source = getProject(originalId);
  let target = getProject(projectId);
  target.slug = slugify(target.name);
  target.description = source.description;
  Project.save(target);
  // And create a new project settings entry
  source = ProjectSettings.find({ project_id: originalId });
  target = ProjectSettings.find({ project_id: projectId });
  target.run_script = source.run_script;
  target.default_file = source.default_file;
  target.default_collapse = source.default_collapse;
  ProjectSettings.save(target, `project_id`);
  return target;
}

/**
 * ...docs go here...
 */
export function createProjectForUser(userName, projectName) {
  const u = User.find({ name: userName });
  const p = Project.create({
    name: projectName,
    slug: slugify(projectName),
  });
  Access.create({ project_id: p.id, user_id: u.id });
  ProjectSettings.create({ project_id: p.id });
  return { user: u, project: p };
}

/**
 * ...docs go here...
 */
export function deleteProject(projectId) {
  const p = getProject(projectId);
  console.log(`deleting project ${p.name} with id ${p.id}`);
  Access.delete({ project_id: p.id });
  Project.delete(p);
  // ON DELETE CASCADE should have taken care of everything else...
}

/**
 * ...docs go here...
 */
export function deleteProjectForUser(userName, projectName, adminCall) {
  const u = getUser(userName);
  const p = getProject(projectName);
  const a = Access.find({ project_id: p.id, user_id: u.id });

  // secondary layer of protection:
  if (a.access_level < OWNER && !adminCall) throw new Error(`Not yours, mate`);

  const { name } = p;

  console.log(`Deleting access rules for project ${name}...`);
  const rules = Access.findAll({ project_id: p.id });
  for (const r of rules) Access.delete(r);

  console.log(`Deleting project ${name}...`);
  Project.delete(p);

  console.log(`Deletion complete.`);
  return name;
}

/**
 * ...docs go here...
 */
export function getAccessFor(userName, projectName) {
  if (!userName) return UNKNOWN_USER;
  const u = User.find({ name: userName });
  if (!u.enabled_at) return NOT_ACTIVATED;
  const p = Project.find({ name: projectName });
  const a = Access.find({ project_id: p.id, user_id: u.id });
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
    if (omitStarters && isStarterProject(p.id)) return;
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
export function getIdForProjectName(projectName) {
  const p = Project.find({ name: projectName });
  if (!p) throw new Error("Project not found");
  return p.id;
}

/**
 * ...docs go here...
 */
export function getNameForProjectId(projectId) {
  const p = Project.find({ id: projectId });
  if (!p) throw new Error("Project not found");
  return p.name;
}

/**
 * ...docs go here...
 */
export function getOwnedProjectsForUser(userNameOrId) {
  const u = getUser(userNameOrId);
  const access = Access.findAll({ user_id: u.id });
  return access
    .filter((a) => a.access_level === OWNER)
    .map((a) => getProject(a.project_id));
}

/**
 * ...docs go here...
 */
export function getProject(projectNameOrId) {
  let p;
  if (typeof projectNameOrId === `number`) {
    p = Project.find({ id: projectNameOrId });
  } else {
    p = Project.find({ name: projectNameOrId });
  }
  if (!p) throw new Error(`Project ${projectNameOrId} not found`);
  return p;
}

/**
 * ...docs go here...
 */
export function getProjectEnvironmentVariables(projectNameOrId) {
  const p = getProject(projectNameOrId);
  const { env_vars } = ProjectSettings.find({ project_id: p.id });
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
export function getProjectSuspensions(projectNameOrId, includeOld = false) {
  let project_id = projectNameOrId;
  if (typeof projectNameOrId !== `number`) {
    const p = Project.find({ name: projectNameOrId });
    project_id = p.id;
  }
  const s = ProjectSuspension.findAll({ project_id });
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
export function isProjectSuspended(projectNameOrId) {
  const p = getProject(projectNameOrId);
  return !!ProjectSuspension.find({ project_id: p.id });
}

/**
 * ...docs go here...
 */
export function isStarterProject(id) {
  return !!StarterProject.find({ project_id: id });
}

/**
 * ...docs go here...
 */
export function loadSettingsForProject(projectId) {
  const p = Project.find({ id: projectId });
  const s = ProjectSettings.find({ project_id: p.id });
  if (!s) return false;
  const { name, description } = p;
  const { project_id, ...settings } = s;
  return {
    name,
    description,
    ...settings,
  };
}

/**
 * ...docs go here...
 */
export function projectSuspendedThroughOwner(projectNameOrId) {
  const p = getProject(projectNameOrId);
  const access = Access.findAll({ project_id: p.id });
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
export function recordProjectRemix(originalId, projectId) {
  Remix.create({ original_id: originalId, project_id: projectId });
}

/**
 * ...docs go here...
 */
export function suspendProject(projectNameOrId, reason, notes = ``) {
  if (!reason) throw new Error(`Cannot suspend project without a reason`);
  const p = getProject(projectNameOrId);
  const s = ProjectSettings.find({ project_id: p.id });
  try {
    if (s.app_type === `static`) {
      stopStaticServer(p.name);
    } else {
      stopContainer(p.name);
    }
    ProjectSuspension.create({ project_id: p.id, reason, notes });
  } catch (e) {
    console.error(e);
    console.log(u, reason, notes);
  }
}

/**
 * ...docs go here...
 */
export function touch(projectNameOrId) {
  const p = getProject(projectNameOrId);
  if (p) Project.save(p);
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
export function updateSettingsForProject(projectId, settings) {
  const { name, description, ...containerSettings } = settings;

  const p = Project.find({ id: projectId });
  if (p.name !== name) {
    if (!name.trim()) throw new Error(`Invalid project name`);
    p.name = name;
    p.slug = slugify(name);
  }
  p.description = description;
  Project.save(p);

  const s = ProjectSettings.find({ project_id: projectId });
  Object.entries(containerSettings).forEach(([key, value]) => {
    s[key] = value;
  });
  ProjectSettings.save(s, `project_id`);
}
