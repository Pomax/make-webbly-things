import {
  bindCommonValues,
  verifyLogin,
  verifyAccesToUser,
} from "../../middleware.js";

import {
  getUserProfile,
  getUserSettings,
  checkAvailableUserName,
  redirectToAuth,
  redirectToProfile,
  removeAuthProvider,
  reserveUserAccount,
  setNewProvider,
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
    }),
);

users.post(
  `/profile/:user`,
  bindCommonValues,
  multer().none(),
  updateUserProfile,
  (req, res) => {
    const { slug } = res.locals.lookups.user;
    res.redirect(`/v1/users/profile/${slug}`);
  },
);

users.get(
  `/service/add/:service`,
  bindCommonValues,
  verifyLogin,
  setNewProvider,
  redirectToAuth,
);

users.get(
  `/service/remove/:service`,
  bindCommonValues,
  verifyLogin,
  removeAuthProvider,
  redirectToProfile,
);

users.get(
  `/settings/:uid`,
  bindCommonValues,
  verifyLogin,
  verifyAccesToUser,
  getUserSettings,
  (req, res) => res.json(res.locals.settings),
);

users.get(
  `/signup/:username`,
  bindCommonValues,
  checkAvailableUserName,
  (req, res) => res.json(res.locals.available),
);

users.post(
  `/signup/:username/:service`,
  bindCommonValues,
  reserveUserAccount,
  redirectToAuth,
);
