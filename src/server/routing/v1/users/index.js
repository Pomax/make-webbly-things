import {
  bindCommonValues,
  verifyLogin,
  verifyAccesToUser,
} from "../../middleware.js";

import { getUserSettings } from "./middleware.js";

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
