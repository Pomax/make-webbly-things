import { unlinkSync } from "node:fs";
import {
  bindCommonValues,
  verifyEditRights,
  verifyLogin,
  verifyOwner,
} from "../../middleware.js";

import {
  checkProjectHealth,
  createProjectDownload,
  deleteProject,
  getProjectSettings,
  loadProject,
  loadProjectHistory,
  remixProject,
  restartProject,
  startProject,
  updateProjectSettings,
} from "./middleware.js";

import { getDirListing } from "../files/middleware.js";

import { Router } from "express";
import multer from "multer";
export const projects = Router();

const { WEB_EDITOR_APPS_HOSTNAME } = process.env;

/**
 * Delete a project by name
 */
projects.post(
  `/delete/:project`,
  verifyLogin,
  bindCommonValues,
  verifyOwner,
  deleteProject,
  (_req, res) => res.send(`ok`),
);

/**
 * Download a project. Doesn't even need to be your own!
 */
projects.get(
  `/download/:project`,
  verifyLogin,
  bindCommonValues,
  getDirListing,
  createProjectDownload,
  (req, res) =>
    res.sendFile(res.locals.zipFile, () => {
      unlinkSync(res.locals.zipFile);
    }),
);

/**
 * Load the editor for a project. This does not necessarily mean the user
 * will be able to *actually* edit the project - that's determined by whether
 * or not they have permission to do so, when handling file operations.
 */
projects.get(
  `/edit/:project`,
  bindCommonValues,
  loadProject,
  // Make sure editor.html has all the render details
  (req, res) =>
    res.render(`editor.html`, {
      currentTime: Date.now(),
      ...res.locals,
      ...req.session,
      ...process.env,
    }),
);

/**
 * Allow the client to check what state a container is for, for UI purposes.
 */
projects.get(
  `/health/:project`,
  bindCommonValues,
  checkProjectHealth,
  (_req, res) => {
    res.send(res.locals.healthStatus);
  },
);

/**
 * Get the git log, to show all rewind points.
 */
projects.get(
  `/history/:project/:commit?`,
  verifyLogin,
  bindCommonValues,
  verifyEditRights,
  loadProjectHistory,
  (_req, res) => res.json(res.locals.history),
);

/**
 * Remix a project
 */
projects.get(
  `/remix/:project/:newname?`,
  verifyLogin,
  bindCommonValues,
  remixProject,
  (req, res) => res.redirect(`/v1/projects/edit/${res.locals.newProjectSlug}`),
);

/**
 * restart a project container
 */
projects.post(
  `/restart/:project`,
  verifyLogin,
  bindCommonValues,
  verifyOwner,
  restartProject,
  (_req, res) => res.send(`ok`),
);

/**
 * Allow the client to check project settings.
 */
projects.get(
  `/settings/:pid`,
  verifyLogin,
  bindCommonValues,
  getProjectSettings,
  (_req, res) => res.json(res.locals.settings),
);

/**
 * Update a project's settings
 */
projects.post(
  `/settings/:pid`,
  verifyLogin,
  bindCommonValues,
  verifyOwner,
  multer().none(),
  getProjectSettings,
  updateProjectSettings,
  (_req, res) => res.send(`/v1/projects/edit/${res.locals.projectSlug}`),
);

/**
 * Start a project's container. This route is
 * generally only called though Caddy's rewriting
 * of an app domain that it doesn't have a resolution
 * rul for.
 */
projects.get(
  `/start/:project/:secret`,
  bindCommonValues,
  startProject,
  (req, res) => {
    const { project } = res.locals.lookups;
    setTimeout(() => {
      res.redirect(`https://${project.slug}.${WEB_EDITOR_APPS_HOSTNAME}`);
    }, 1000);
  },
  // Custom 404 for app domains
  (err, req, res, next) => {
    res.render(`not-found.html`);
  },
);
