import * as Database from "../../../database/index.js";

export function getUserSettings(req, res, next) {
  const { user } = res.locals.lookups ?? {};
  res.locals.settings = Database.getUserSettings(user);
  next();
}
