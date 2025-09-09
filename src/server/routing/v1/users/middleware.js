import * as Database from "../../../database/index.js";
import { slugify } from "../../../../helpers.js";

/**
 * ...docs go here...
 */
export function checkAvailableUserName(req, res, next) {
  let { username } = req.params;
  username = username.trim();
  const slug = slugify(username);
  if (!username || !slug) {
    return next(new Error(`Empty username`));
  }
  try {
    res.locals.available = !Database.getUser(slug);
  } catch (e) {
    res.locals.available = true;
  }
  next();
}

/**
 * ...docs go here...
 */
export function getUserProfile(req, res, next) {
  const { user } = res.locals;
  const { user: lookupUser } = res.locals.lookups ?? {};
  if (!lookupUser) {
    return next(new Error(`Unknown user`));
  }
  res.locals.profile = Database.getUserProfile(user, lookupUser);
  next();
}

/**
 * ...docs go here...
 */
export function getUserSettings(req, res, next) {
  const { user } = res.locals.lookups ?? {};
  res.locals.settings = Database.getUserSettings(user);
  next();
}

/**
 * ...docs go here...
 */
export function reserveUserAccount(req, res, next) {
  let { username } = req.params;
  username = username.trim();
  const slug = slugify(username);
  if (!username || !slug) {
    return next(new Error(`Empty username`));
  }
  try {
    Database.getUser(slug);
    next(new Error(`User account already taken`));
  } catch (e) {
    // Store the reserved user account in the user's
    // session, so that when they pick their auth broker
    // and log in, we can tie account and auth together:
    req.session.reservedAccount = { username, slug };
    req.session.save();
    next();
  }
}

/**
 * ...docs go here...
 */
export function updateUserProfile(req, res, next) {
  const requester = res.locals.user;
  const user = res.locals.lookups.user;

  if (user.id !== requester.id && !Database.userIsAdmin(requester)) {
    return next(new Error(`Cannot update profile`));
  }

  Database.updateUserProfile(user, req.body);
  res.locals.profile = Database.getUserProfile(user, user);
  next();
}
