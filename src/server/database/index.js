import { join } from "node:path";
import { applyMigrations } from "./utils.js";

import {
  readContentDir,
  scrubDateTime,
  TESTING,
  ROOT_DIR,
} from "../../helpers.js";

import {
  UNKNOWN_USER,
  NOT_ACTIVATED,
  OWNER,
  EDITOR,
  MEMBER,
  Models,
  db,
} from "./models.js";

export { UNKNOWN_USER, NOT_ACTIVATED, OWNER, EDITOR, MEMBER, Models };

// User related database functions
import {
  deleteUser,
  disableUser,
  enableUser,
  getAllUsers,
  getUser,
  getUserProfile,
  userIsAdmin,
  getUserSettings,
  getUserSuspensions,
  hasAccessToUserRecords,
  hasAccessToProject,
  processUserLogin,
  processUserSignup,
  removeAuthProvider,
  suspendUser,
  unsuspendUser,
  updateUserProfile,
} from "./user.js";

export {
  deleteUser,
  disableUser,
  enableUser,
  getAllUsers,
  getUser,
  getUserProfile,
  userIsAdmin,
  getUserSettings,
  getUserSuspensions,
  hasAccessToUserRecords,
  hasAccessToProject,
  processUserLogin,
  processUserSignup,
  removeAuthProvider,
  suspendUser,
  unsuspendUser,
  updateUserProfile,
};

// Project related database functions
import {
  copyProjectSettings,
  createProjectForUser,
  deleteProjectForUser,
  getAccessFor,
  getAllProjects,
  getMostRecentProjects,
  getOwnedProjectsForUser,
  getProject,
  getProjectEnvironmentVariables,
  getProjectListForUser,
  getProjectSuspensions,
  getStarterProjects,
  isProjectSuspended,
  isStarterProject,
  projectSuspendedThroughOwner,
  recordProjectRemix,
  suspendProject,
  touch,
  unsuspendProject,
  updateSettingsForProject,
} from "./project.js";

export {
  copyProjectSettings,
  createProjectForUser,
  deleteProjectForUser,
  getAccessFor,
  getAllProjects,
  getMostRecentProjects,
  getOwnedProjectsForUser,
  getProject,
  getProjectEnvironmentVariables,
  getProjectListForUser,
  getProjectSuspensions,
  getStarterProjects,
  isProjectSuspended,
  isStarterProject,
  projectSuspendedThroughOwner,
  recordProjectRemix,
  suspendProject,
  touch,
  unsuspendProject,
  updateSettingsForProject,
};

const dataPath = join(ROOT_DIR, `data`);

/**
 * Are we on the right version of the database?
 */
export async function getMigrationStatus() {
  let version = db.prepare(`PRAGMA user_version`).get().user_version;
  const { files } = readContentDir(join(dataPath, `migrations`));
  const migrations = files
    .map((v) => parseFloat(v.match(/\d+/)?.[0]))
    .filter(Boolean)
    .sort((a, b) => a - b);
  const last = (migrations.at(-1) ?? 0) + 1;
  return last - version;
}

/**
 * This should be obvious... =D
 */
export async function initTestDatabase() {
  if (!TESTING) return;

  // Ensure the test database is up to date
  await applyMigrations(join(dataPath, `test.sqlite3`));

  const now = scrubDateTime(new Date().toISOString());

  // Create an admin user
  const admin = Models.User.findOrCreate({
    name: `test admin`,
    bio: `This is a test administrator account.`,
  });
  const admin_id = admin.id;
  admin.enabled_at = now;
  Models.User.save(admin);
  Models.Admin.findOrCreate({ user_id: admin_id });

  // And a regular user
  const user = Models.User.findOrCreate({
    name: `test user`,
    bio: `This is a normal user account.`,
  });
  const user_id = user.id;
  user.enabled_at = now;
  Models.User.save(user);

  // Create a "starter" project
  const starter = Models.Project.findOrCreate({
    name: `test starter`,
    description: `a starter project`,
  });
  Models.StarterProject.findOrCreate({ project_id: starter.id });

  // Then create a project for our regular user and pretend
  // that it was a remix of our "starter" project.
  const project = Models.Project.findOrCreate({
    name: `test project`,
    description: `a test project`,
  });
  const project_id = project.id;
  Models.ProjectSettings.findOrCreate({
    project_id,
    run_script: `npx http-server`,
  });
  Models.Access.findOrCreate({ project_id, user_id });
  Models.Remix.findOrCreate({ original_id: starter.id, project_id });
}

/**
 *
 * @returns
 */
export function concludeTesting() {
  if (!TESTING) return;
  db.exec(`DELETE FROM users`);
  db.exec(`DELETE FROM projects`);
  db.exec(`DELETE FROM remix`);
  db.close();
}
