import { unlinkSync, rmSync } from "node:fs";
import { join } from "node:path";
import { stopContainer, stopStaticServer } from "../docker/docker-helpers.js";
import { CONTENT_DIR, pathExists, slugify } from "../../helpers.js";
import { Models } from "./models.js";
import { getOwnedProjectsForUser } from "./project.js";
import { validProviders } from "../routing/auth/index.js";

const {
  User,
  UserLink,
  Project,
  ProjectSettings,
  Access,
  Admin,
  UserSuspension,
  Login,
} = Models;

// Ensure that the user slug is always up to date
// based on the user name, which means updating
// several data-writing functions.
(function enhanceUserModel() {
  function runOp(operation, fields) {
    // ensure the slug is always correct
    if (fields.name) fields.slug = slugify(fields.name);
    const admin = fields.admin;
    delete fields.admin;
    const result = operation(fields);
    fields.admin = admin;
    return result;
  }

  [`insert`, `save`, `delete`, `findAll`].forEach((fn) => {
    const original = User[fn].bind(User);
    User[fn] = (fields) => runOp(original, fields);
  });
})();

/**
 * Create a user account and tie it to this auth session
 * @param {*} username
 * @param {*} userObject
 */
export function processUserSignup(username, userObject) {
  // Make extra sure we can safely register this user:
  const slug = slugify(username);
  console.log(`processing signup for ${username}/${slug}`);
  try {
    getUser(slug);
    throw new Error(`Username already taken.`);
  } catch (e) {
    // this is what we want: "error: no user found".
  }
  const { service, service_id } = userObject;
  const existingLogin = Login.find({ service, service_id });
  if (existingLogin) {
    // Nice try, but you only get one user account
    // per remote account at an auth service =)
    return processUserLogin(userObject);
  }
  // Unknown user, and unknown service login: create a new account!
  const user = User.create({ name: username });
  Login.create({ user_id: user.id, service, service_id });
  return user;
}

/**
 * Process a login attempt by looking up who is
 * logging in based on their auth service name
 * and their id local to that service.
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
  const { service, service_id } = userObject;
  const login = Login.find({ service, service_id });
  if (!login) {
    throw new Error(`No user tied to this service`);
  }
  const user = getUser(login.user_id);
  user.admin = userIsAdmin(user);
  if (!user.admin) {
    const s = getUserSuspensions(user);
    if (s.length) {
      throw new Error(
        `This user account has been suspended (${s.map((s) => `"${s.reason}"`).join(`, `)})`,
      );
    }
  }
  return user;
}

// On the other hand, after first-time setup, we want the first
// login to automatically become an enabled user account with
// admin rights, so that you can run setup, log in, and get going.
function __processFirstTimeUserLogin(userObject) {
  unlinkSync(firstTimeSetup);
  __processUserLogin = processUserLoginNormally;
  const { profileName, service, service_id } = userObject;
  console.log(`First time login: marking ${profileName} as admin`);
  const user = User.create({ name: profileName });
  Login.create({ user_id: user.id, service, service_id });
  Admin.create({ user_id: user.id });
  user.enabled_at = user.created_at;
  user.admin = true;
  User.save(user);
  return user;
}

/**
 * Add a login provider for a user account
 */
export function addLoginProviderForUser(user, userObject) {
  const { service, service_id } = userObject;
  let login = Login.find({ user_id: user.id, service });
  if (login) {
    return processUserLoginNormally(userObject);
  }
  Login.create({ user_id: user.id, service, service_id });
  return user;
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
export function getUser(userSlugOrId) {
  let u;
  if (typeof userSlugOrId === `number`) {
    u = User.find({ id: userSlugOrId });
  } else {
    u = User.find({ slug: userSlugOrId });
  }
  if (!u) throw new Error(`User not found`);
  return u;
}

/**
 * ...docs go here...
 */
export function getUserLoginServices(user) {
  return Login.findAll({ user_id: user.id });
}

/**
 * ...docs go here...
 */
export function getUserProfile(user = {}, lookupUser) {
  const ownProfile = user.id === lookupUser.id;
  const services = ownProfile
    ? getUserLoginServices(user).map((s) => s.service)
    : undefined;
  const additionalServices = validProviders.filter(
    (e) => !services.includes(e),
  );
  return {
    user: lookupUser,
    links: UserLink.findAll({ user_id: lookupUser.id }, `sort_order`, `DESC`),
    projects: getOwnedProjectsForUser(lookupUser),
    services,
    additionalServices,
    ownProfile,
  };
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

/**
 * ...docs go here...
 */
export function updateUserProfile(user, profile) {
  let { bio, linkNames, linkHrefs, linkOrder } = profile;

  // Update the user bio, if that changed:
  if (user.bio !== bio) user.bio = bio;
  User.save(user);

  // Then, remove all links for this user...
  const links = UserLink.findAll({ user_id: user.id });
  links.forEach((link) => UserLink.delete(link));

  //
  if (!linkNames) return;

  if (!linkNames.map) {
    linkNames = [linkNames];
    linkHrefs = [linkHrefs];
    linkOrder = [linkOrder];
  }

  // And then (re)insert what the form gave us.
  linkNames?.forEach((name, i) =>
    UserLink.create({
      user_id: user.id,
      name,
      url: linkHrefs[i],
      sort_order: parseFloat(linkOrder[i]),
    }),
  );
}
