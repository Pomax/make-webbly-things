import { unlinkSync, rmSync } from "node:fs";
import { join } from "node:path";
import { stopContainer, stopStaticServer } from "../docker/docker-helpers.js";
import { CONTENT_DIR, pathExists } from "../../helpers.js";
import { Models } from "./models.js";
import { getOwnedProjectsForUser } from "./project.js";

const { User, Project, ProjectSettings, Access, Admin, UserSuspension, Login } =
  Models;

/**
 * ...docs go here...
 */
export function processUserLogin(userObject) {
  return __processUserLogin(userObject);
}

const firstTimeSetup = `.finish-setup`;

// switch-binding based on whether this is first time setup
let __processUserLogin = pathExists(firstTimeSetup)
  ? __processFirstTimeUserLogin
  : processUserLoginNormally;

// This will be the usual function binding, where users
// are added to the database but they are not enabled
// by default, and an admin will have to approve them.
function processUserLoginNormally(userObject) {
  const { userName, service, service_id } = userObject;
  const l = Login.find({ service, service_id });
  if (l) {
    const u = User.find({ id: l.user_id });
    if (!u) {
      // This shouldn't be possible, so...
      throw new Error(`User not found`);
    }
    const s = getUserSuspensions(u);
    if (s.length) {
      throw new Error(
        `This user account has been suspended (${s.map((s) => `"${s.reason}"`).join(`, `)})`,
      );
    }
    // Is this user an admin? If so, ammend the session record.
    const a = Admin.find({ user_id: u.id });
    return { ...u, admin: a ? true : undefined };
  }

  // No login binding: new user or username conflict?
  const u = User.find({ name: userName });
  if (!u) {
    const u = User.create({ name: userName });
    Login.create({ user_id: u.id, service, service_id });
    return u;
  }

  throw new Error(`User ${userName} already exists`);
}

// On the other hand, after first-time setup, we want the first
// login to automatically become an enabled user account with
// admin rights, so that you can run setup, log in, and get going.
function __processFirstTimeUserLogin(userObject) {
  __processUserLogin = processUserLoginNormally;
  const { userName, service, service_id } = userObject;
  console.log(`First time login: marking ${userName} as admin`);
  const u = User.create({ name: userName });
  Login.create({ user_id: u.id, service, service_id });
  Admin.create({ user_id: u.id });
  u.enabled_at = u.created_at;
  User.save(u);
  unlinkSync(firstTimeSetup);
  return { ...u, admin: true };
}

/**
 * ...docs go here...
 */
export function deleteUser(user) {
  console.log(`deleting user ${user.name} with id ${user.id}`);
  const access = Access.findAll({ user_id: user.id });
  Access.delete({ user_id: user.id });
  access.forEach(({ project_id }) => {
    const p = Project.find({ id: project_id });
    if (p && Access.findAll({ project_id }).length === 0) {
      Project.delete(p);
      const projectDir = join(CONTENT_DIR, p.slug);
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
  User.delete(user);
  // ON DELETE CASCADE should have taken care of everything else...
}

/**
 * ...docs go here...
 */
export function disableUser(user) {
  user.enabled_at = null;
  User.save(user);
  return user;
}

/**
 * ...docs go here...
 */
export function enableUser(user) {
  user.enabled_at = new Date().toISOString();
  User.save(user);
  return user;
}

/**
 * ...docs go here...
 */
export function getAllUsers() {
  const userList = {};

  const users = User.all(`name`);
  users.forEach((u) => {
    if (!u) return;
    u.suspensions = [];
    userList[u.id] = u;
  });

  const admins = Admin.all();
  admins.forEach((a) => {
    if (!a) return;
    userList[a.user_id].admin = true;
  });

  const suspensions = UserSuspension.all(`user_id`);
  suspensions.forEach((s) => {
    if (!s) return;
    userList[s.user_id].suspensions.push(s);
    if (!s.invalidated_at) {
      userList[s.user_id].activeSuspensions = true;
    }
  });

  return Object.values(userList);
}

/**
 * ...docs go here...
 */
export function getUser(userNameOrId) {
  let u;
  if (typeof userNameOrId === `number`) {
    u = User.find({ id: userNameOrId });
  } else {
    u = User.find({ name: userNameOrId });
  }
  if (!u) throw new Error(`User not found`);
  return u;
}

/**
 * ...docs go here...
 */
export function userIsAdmin(user) {
  const a = Admin.find({ user_id: user.id });
  if (!a) return false;
  return true;
}

/**
 * ...docs go here...
 */
export function getUserSettings(user) {
  const s = UserSuspension.find({ user_id: user.id });
  const a = Admin.find({ user_id: user.id });
  return {
    name: user.name,
    admin: a ? true : false,
    enabled: user.enabled_at ? true : false,
    suspended: s ? true : false,
  };
}

/**
 * ...docs go here...
 */
export function getUserSuspensions(user, includeOld = false) {
  const s = UserSuspension.findAll({ user_id: user.id });
  if (includeOld) return s;
  return s.filter((s) => !s.invalidated_at);
}

/**
 * ...docs go here...
 */
export function hasAccessToUserRecords(user, targetUser) {
  if (user.id === targetUser.id) return true;
  const a = Admin.find({ user_id: user.id });
  if (!a) return false;
  return true;
}

/**
 * ...docs go here...
 */
export function suspendUser(user, reason, notes = ``) {
  if (!reason) throw new Error(`Cannot suspend user without a reason`);
  try {
    const suspension = UserSuspension.create({
      user_id: user.id,
      reason,
      notes,
    });
    const projects = getOwnedProjectsForUser(user);
    projects.forEach((p) => {
      const s = ProjectSettings.find({ project_id: p.id });
      if (s.app_type === `static`) {
        stopStaticServer(p);
      } else {
        stopContainer(p);
      }
    });
    return suspension;
  } catch (e) {
    console.error(e);
    console.log(user, reason, notes);
  }
}

/**
 * ...docs go here...
 */
export function unsuspendUser(suspensionId) {
  const s = UserSuspension.find({ id: suspensionId });
  if (!s) throw new Error(`Suspension not found`);
  s.invalidated_at = new Date().toISOString();
  UserSuspension.save(s);
}
