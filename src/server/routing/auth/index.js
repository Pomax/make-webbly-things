import { Router } from "express";
import { processUserSignup, processUserLogin } from "../../database/index.js";

import { passport } from "./middleware.js";
import { Strategy as GitHubStrategy } from "passport-github2";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as MagicLoginStrategy } from "passport-magic-link";
import { Strategy as MastodonStrategy } from "passport-mastodon";

import {
  handleGithubCallback,
  loginWithGithub,
  handleGoogleCallback,
  loginWithGoogle,
  handleMastodonCallback,
  loginWithMastodon,
  logout,
} from "./middleware.js";

import {
  googleSettings,
  githubSettings,
  magicSettings,
  mastodonSettings,
  validProviders,
  getServiceDomain,
} from "./settings.js";

import { addLoginProviderForUser } from "../../database/user.js";
import { bindCommonValues, verifyLogin } from "../middleware.js";
import { randomUUID } from "node:crypto";
const { WEB_EDITOR_HOSTNAME } = process.env;

const PERSONAL_LINK_TTL = 12 * 3600 * 1000; // 12h in milliseconds

/**
 * Is this a provider that we actually have auth for?
 */
export function validAuthProvider(provider) {
  return validProviders.includes(provider);
}

/**
 * Set up all auth methods for this platform.
 */
export function addPassportAuth(app) {
  app.use(passport.initialize());
  app.use(passport.session());
  addGoogleAuth(app);
  addGithubAuth(app);
  addEmailAuth(app);
  addMastodonAuth(app);
  addPersonalAuthLinks(app);
  app.use(`/auth/logout`, (req, res, next) =>
    req.logout((err) => {
      if (err) return next(err);
      res.redirect(`/`);
    }),
  );
}

/**
 * ...docs go here...
 * @param {*} req
 * @param {*} accessToken
 * @param {*} refreshToken
 * @param {*} profile
 * @param {*} done
 * @returns
 */
export function processOAuthLogin(
  req,
  accessToken,
  refreshToken,
  profile,
  done,
) {
  const { user: sessionUser } = req.session.passport ?? {};

  // Are there special circumstances surrounding this callback?
  const { username, slug, newProvider } = req.session.reservedAccount ?? {};
  delete req.session.reservedAccount;
  req.session.save();

  const userObject = {
    profileName: profile.displayName,
    service: profile.provider,
    service_id: profile.id,
    service_domain: getServiceDomain(profile.provider),
  };

  let user;

  // If we have a user slug, this is a new account signup
  if (username && slug) {
    user = processUserSignup(username, userObject);
  }

  // If we have a new provider name, we need to add this
  // as an additional login provider for this user's account
  else if (newProvider) {
    user = addLoginProviderForUser(sessionUser, userObject);
  }

  // If not, this is a regular login, where we need to find
  // the user that belongs to this service profile.
  else {
    user = processUserLogin(userObject);
  }

  return done(null, user);
}

/**
 * Set up github auth
 */
export function addGithubAuth(app, settings = githubSettings) {
  if (!settings) return;

  const githubStrategy = new GitHubStrategy(settings, processOAuthLogin);
  passport.use(githubStrategy);

  const github = Router();
  github.get(`/error`, (req, res) => res.send(`Unknown Error`));
  github.get(`/callback`, handleGithubCallback, (req, res) =>
    res.redirect(`/`),
  );
  github.get(`/logout`, logout);
  github.get(`/`, loginWithGithub);
  app.use(`/auth/github`, github);
}

/**
 * Set up google auth
 */
export function addGoogleAuth(app, settings = googleSettings) {
  if (!settings) return;

  const googleStrategy = new GoogleStrategy(settings, processOAuthLogin);
  passport.use(googleStrategy);

  const google = Router();
  google.get(`/error`, (req, res) => res.send(`Unknown Error`));
  google.get(`/callback`, handleGoogleCallback, (req, res) =>
    res.redirect(`/`),
  );
  google.get(`/logout`, logout);
  google.get(`/`, loginWithGoogle);
  app.use(`/auth/google`, google);
}

/**
 * Set up mastodon auth
 */
export function addMastodonAuth(app, settings = mastodonSettings) {
  if (!settings) return;

  const mastodonStrategy = new MastodonStrategy(settings, processOAuthLogin);
  passport.use(mastodonStrategy);

  const mastodon = Router();
  mastodon.get(`/error`, (req, res) => res.send(`Unknown Error`));
  mastodon.get(`/callback`, handleMastodonCallback, (req, res) =>
    res.redirect(`/`),
  );
  mastodon.get(`/logout`, logout);
  mastodon.get(`/`, loginWithMastodon);
  app.use(`/auth/mastodon`, mastodon);
}

/**
 * Set up direct auth links, for when logged in users need
 * to log in a device that has no github or google etc. login
 */
export function addPersonalAuthLinks(app) {
  const personal = Router();
  const transientCodes = {};

  function generateLoginLink(req, res, next) {
    const { user } = res.locals;
    const loginCode = randomUUID();
    transientCodes[loginCode] = {
      user,
      createdAt: Date.now(),
      ttl: PERSONAL_LINK_TTL,
    };
    res.locals.authLink = `https://${WEB_EDITOR_HOSTNAME}/auth/personal/login/${loginCode}`;
    next();
  }

  // Generate a one-time-use auth link
  personal.get(
    // TODO: this probably wants some kind of express-rate-limit
    `/link`,
    bindCommonValues,
    verifyLogin,
    generateLoginLink,
    (req, res) => res.send(res.locals.authLink),
  );

  // Generate the confirmation-seeking page (so that
  // link previewers don't log in for you!)
  personal.get(
    // TODO: this probably wants some kind of express-rate-limit
    `/login/:uuid`,
    bindCommonValues,
    (req, res) =>
      res.render(`direct-login.html`, {
        ...req.params,
      }),
  );

  function validatePersonalLogin(req, res, next) {
    const { uuid } = req.params;
    if (!transientCodes[uuid]) {
      // Invalid auth code... but we don't actually want to
      // inform users that they're using an invalid auth code,
      // so they can't just script themselves some access.
      return next();
    }
    const { user, createdAt, ttl } = transientCodes[uuid];
    delete transientCodes[uuid];
    if (createdAt + ttl < Date.now()) {
      // Expired auth code... but again, we don't want to
      // announce that to the world. We just silently fail.
      return next();
    }
    req.session.user = user;
    req.session.save();
    next();
  }

  // Confirm the link uuid, and if it's good, log this user in.
  // If not, just send them to the front page and you'll wonder
  // why they didn't end up logged in.
  personal.get(
    // TODO: this probably wants some kind of express-rate-limit
    `/confirm/:uuid`,
    bindCommonValues,
    validatePersonalLogin,
    (req, res) => res.redirect(`/`),
  );

  app.use(`/auth/personal`, personal);
}

/**
 * Set up magic link auth
 */
export function addEmailAuth(app, settings = magicSettings) {
  if (!settings) return;

  const magicStrategy = new MagicLoginStrategy(
    settings,
    function send(user, token) {
      const url = `https://${WEB_EDITOR_HOSTNAME}/auth/email/verify?token=${token}`;
      console.log(`send:`, user, url);
      user = {
        userName: user.email,
        service: `magic link`,
        service_id: user.email,
      };
      const u = processUserLogin(user);
      console.log(`created user`, u);
    },
    async function verify(user) {
      console.log(`verify:`, user);
      return processUserLogin({
        userName: user.email,
        service: `magic link`,
        service_id: user.email,
      });
    },
  );

  passport.use(magicStrategy);

  const magic = Router();
  magic.post(
    `/`,
    passport.authenticate(`magiclink`, {
      action: `requestToken`,
      failureRedirect: `/`,
    }),
    (req, res) => {
      res.redirect(`/auth/email/check`);
    },
  );

  magic.get(`/check`, (req, res) => {
    console.log(`user should check their email`);
    res.send(`For now, check the console for the link.`);
  });

  magic.get(
    `/verify`,
    passport.authenticate(`magiclink`, {
      successReturnToOrRedirect: `/`,
      failureRedirect: `/`,
    }),
  );

  app.use(`/auth/email`, magic);
}
