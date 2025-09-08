import {
  bindCommonValues,
  verifyLogin,
  verifyAccesToUser,
} from "../../middleware.js";

import {
  getUserSettings,
  checkAvailableUserName,
  reserveUserAccount,
} from "./middleware.js";

import { Router } from "express";
export const users = Router();

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
