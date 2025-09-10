import { validAuthProvider } from "../../auth/index.js";
import {
  bindCommonValues,
  verifyLogin,
  verifyAccesToUser,
} from "../../middleware.js";

import {
  getUserProfile,
  getUserSettings,
  checkAvailableUserName,
  reserveUserAccount,
  updateUserProfile,
} from "./middleware.js";

import { Router } from "express";
import multer from "multer";
export const users = Router();

users.get(
  // stop putting everything on one line, prettier.
  `/profile/:user`,
  bindCommonValues,
  getUserProfile,
  (req, res) =>
    res.render(`profile.html`, {
      ...process.env,
      ...res.locals,
    })
);

users.post(
  `/profile/:user`,
  bindCommonValues,
  multer().none(),
  updateUserProfile,
  (req, res) => {
    const { slug } = res.locals.lookups.user;
    res.redirect(`/v1/users/profile/${slug}`);
  }
);

users.get(
  `/service/add/:service`,
  verifyLogin,
  bindCommonValues,
  (req, res, next) => {
    // Set a flag that tells the system this user is
    // adding a new auth provider to their account
    req.session.reservedAccount = {
      newProvider: req.params.service.trim(),
    };
    req.session.save();
    next();
  },
  redirectToAuth
);

users.get(
  `/settings/:uid`,
  verifyLogin,
  bindCommonValues,
  verifyAccesToUser,
  getUserSettings,
  (req, res) => res.json(res.locals.settings)
);

users.get(
  `/signup/:username`,
  bindCommonValues,
  checkAvailableUserName,
  (req, res) => res.json(res.locals.available)
);

users.post(
  `/signup/:username/:service`,
  bindCommonValues,
  reserveUserAccount,
  redirectToAuth
);

/**
 * Send a user into an auth flow, if we
 * know the service they told us to use
 */
function redirectToAuth(req, res, next) {
  const service = req.params.service.trim();
  if (!validAuthProvider(service)) {
    return next(new Error(`Unknown login service`));
  }
  res.redirect(`/auth/${service}`);
}
