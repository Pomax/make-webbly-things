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
  (_req, res) =>
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
  (_req, res) => {
    const { slug } = res.locals.lookups.user;
    res.redirect(`/v1/users/profile/${slug}`);
  },
);

users.get(
  `/settings/:uid`,
  verifyLogin,
  bindCommonValues,
  verifyAccesToUser,
  getUserSettings,
  (_req, res) => res.json(res.locals.settings),
);

users.get(
  `/signup/:username`,
  bindCommonValues,
  checkAvailableUserName,
  (_req, res) => res.json(res.locals.available),
);

users.post(
  `/signup/:username`,
  bindCommonValues,
  reserveUserAccount,
  // For now we redirect to the github auth
  // flow, but ultimately this should redirect
  // to a page that offers more than one auth
  // solution. However, we will never add
  // email based login because we don't want
  // that kind of information in our db.
  (_req, res) => res.redirect(`/auth/github`),
);
