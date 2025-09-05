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
  try {
    Docker.stopStaticServer(req.params.name);
    next();
  } catch (e) {
    next(e);
  }
}

// Container related routes

export function deleteContainer(req, res, next) {
  try {
    Docker.deleteContainer(containerreq.params.idId);
    next();
  } catch (e) {
    next(e);
  }
}

export function stopContainer(req, res, next) {
  try {
    Docker.stopContainer(req.params.image);
    next();
  } catch (e) {
    next(e);
  }
}

// User related routes

export function deleteUser(req, res, next) {
  try {
    Database.deleteUser(res.locals.lookups.user);
    next();
  } catch (e) {
    next(e);
  }
}

export function disableUser(req, res, next) {
  try {
    Database.disableUser(res.locals.lookups.user);
    next();
  } catch (e) {
    next(e);
  }
}

export function enableUser(req, res, next) {
  try {
    Database.enableUser(res.locals.lookups.user);
    next();
  } catch (e) {
    next(e);
  }
}

export function suspendUser(req, res, next) {
  try {
    Database.suspendUser(res.locals.lookups.user.id, req.body.reason);
    next();
  } catch (e) {
    next(e);
  }
}

export function unsuspendUser(req, res, next) {
  try {
    const suspensionId = parseFloat(req.params.sid);
    Database.unsuspendUser(suspensionId);
    next();
  } catch (e) {
    next(e);
  }
}

// Project related routes

export function deleteProject(req, res, next) {
  // This requires a bunch of work that we're already
  // doing in our project route middleware:
  ProjectRoutes.deleteProject(req, res, next);
}

export function suspendProject(req, res, next) {
  try {
    Database.suspendProject(res.locals.lookups.project, req.body.reason);
    next();
  } catch (e) {
    next(e);
  }
}

export function unsuspendProject(req, res, next) {
  try {
    const suspensionId = parseFloat(req.params.sid);
    Database.unsuspendProject(suspensionId);
    next();
  } catch (e) {
    next(e);
  }
}
