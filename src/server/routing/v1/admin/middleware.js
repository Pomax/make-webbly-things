import * as Database from "../../../database/index.js";
import * as Docker from "../../../docker/docker-helpers.js";
import * as ProjectRoutes from "../projects/middleware.js";

export function back(req, res) {
  res.redirect(`/v1/admin`);
}

// Obviously this does not scale to thousands of users and projects,
// but this codebase is not designed not intended for that scale.
export function loadAdminData(req, res, next) {
  res.locals.admin = {
    userList: Database.getAllUsers(),
    projectList: Database.getAllProjects(),
    containerList: Docker.getAllRunningContainers(),
    serverList: Docker.getAllRunningStaticServers(),
  };
  next();
}

// Server related routes

export function stopServer(req, res, next) {
  Docker.stopStaticServer(req.params.name);
  next();
}

// Container related routes

export function deleteContainer(req, res, next) {
  Docker.deleteContainer(containerreq.params.idId);
  next();
}

export function stopContainer(req, res, next) {
  Docker.stopContainer(req.params.image);
  next();
}

// User related routes

export function deleteUser(req, res, next) {
  Database.deleteUser(res.locals.lookups.user.id);
  next();
}

export function disableUser(req, res, next) {
  Database.disableUser(res.locals.lookups.user.id);
  next();
}

export function enableUser(req, res, next) {
  Database.enableUser(res.locals.lookups.user.id);
  next();
}

export function suspendUser(req, res, next) {
  Database.suspendUser(res.locals.lookups.user.id, req.body.reason);
  next();
}

export function unsuspendUser(req, res, next) {
  const suspensionId = parseFloat(req.params.sid);
  Database.unsuspendUser(suspensionId);
  next();
}

// Project related routes

export function deleteProject(req, res, next) {
  // This requires a bunch of work that we're already
  // doing in our project route middleware:
  ProjectRoutes.deleteProject(req, res, next);
}

export function suspendProject(req, res, next) {
  Database.suspendProject(res.locals.lookups.project, req.body.reason);
  next();
}

export function unsuspendProject(req, res, next) {
  const suspensionId = parseFloat(req.params.sid);
  Database.unsuspendProject(suspensionId);
  next();
}
