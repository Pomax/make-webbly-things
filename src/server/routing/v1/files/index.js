// "route agnostic" middleware
import {
  bindCommonValues,
  parseBodyText,
  parseMultiPartBody,
  verifyLogin,
  verifyEditRights,
} from "../../middleware.js";

// "file specific" middleware
import {
  confirmAccessToFile,
  createFile,
  deleteFile,
  formatFile,
  getDirListing,
  getMimeType,
  handleUpload,
  moveFile,
  patchFile,
} from "./middleware.js";

import { Router } from "express";
export const files = Router();

const prechecks = [verifyLogin, bindCommonValues, verifyEditRights];

/**
 *  Get the project files for populating the <file-tree>, making sure to filter
 *  out any files that should be filtered out based on the requesting user's
 *  permissions for this project (e.g. don't show the "data" dir to viewers,
 *  don't show the .env file to collaborators, don't filter for owners)
 */
files.get(`/dir/:project`, bindCommonValues, getDirListing, (_req, res) =>
  res.json(res.locals.dirData),
);

/**
 * Get a file's content.
 */
files.get(
  `/content/:project/:filename*`,
  bindCommonValues,
  confirmAccessToFile,
  getMimeType,
  (req, res) => {
    res.set(`Content-Type`, res.locals.mimeType);
    res.send(res.locals.data);
  },
);

/**
 * Create a file
 */
files.post(
  `/create/:project/:filename*`,
  ...prechecks,
  createFile,
  (req, res) => res.send(`ok`),
);

/**
 * Create a file
 */
files.delete(
  `/delete/:project/:filename*`,
  ...prechecks,
  deleteFile,
  (req, res) => res.send(`ok`),
);

/**
 * Format a file
 */
files.post(
  `/format/:project/:filename*`,
  ...prechecks,
  formatFile,
  (req, res) =>
    res.json({
      formatted: res.locals.formatted,
    }),
);

/**
 * Process a file change request: only members and owners should be able to
 * effect file changes. Regular "vieewers" should get ignored entirely.
 */
files.post(
  `/sync/:project/:filename*`,
  ...prechecks,
  parseBodyText,
  patchFile,
  (_req, res) => res.send(res.locals.fileHash),
);

/**
 * Rename/move a file
 */
files.post(`/rename/:project/:slug*`, ...prechecks, moveFile, (req, res) =>
  res.send(`ok`),
);

/**
 * Upload a file into a specific project
 */
files.post(
  `/upload/:project/:filename*`,
  ...prechecks,
  parseMultiPartBody,
  handleUpload,
  (req, res) => res.send(`ok`),
);
