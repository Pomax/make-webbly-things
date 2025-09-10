import { Router } from "express";
import { join } from "node:path";
import { passport } from "./middleware.js";
import { Strategy as GitHubStrategy } from "passport-github2";
import { Strategy as MagicLoginStrategy } from "passport-magic-link";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { processUserSignup, processUserLogin } from "../../database/index.js";
import {
  handleGithubCallback,
  handleGoogleCallback,
  loginWithGithub,
  loginWithGoogle,
  logout,
} from "./middleware.js";
import { googleSettings, githubSettings, magicSettings } from "./settings.js";

// Explicit env loading as we rely on process.env
// at the module's top level scope...
import dotenv from "@dotenvx/dotenvx";
import { addLoginProviderForUser } from "../../database/user.js";
const envPath = join(import.meta.dirname, `../../../../.env`);
dotenv.config({ path: envPath, quiet: true });
const { WEB_EDITOR_HOSTNAME } = process.env;
const testing = process.env.LOCAL_DEVTESTING === `true`;

export const validProviders = [`google`, `github`];
if (testing) validProviders.push(`email`);

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
  app.use(`/auth/logout`, (req, res, next) =>
    req.logout((err) => {
      if (err) return next(err);
      res.redirect(`/`);
    })
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
function processOAuthLogin(req, accessToken, refreshToken, profile, done) {
  const { user: sessionUser } = req.session.passport ?? {};
  const { username, slug, newProvider } = req.session.reservedAccount ?? {};

  const userObject = {
    profileName: profile.displayName,
    service: profile.provider,
    service_id: profile.id,
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
 * Set up google auth
 */
function addGoogleAuth(app) {
  const googleStrategy = new GoogleStrategy(googleSettings, processOAuthLogin);

  passport.use(googleStrategy);

  const google = Router();
  google.get(`/error`, (req, res) => res.send(`Unknown Error`));
  google.get(`/callback`, handleGoogleCallback, (req, res) =>
    res.redirect(`/`)
  );
  google.get(`/logout`, logout);
  google.get(`/`, loginWithGoogle);
  app.use(`/auth/google`, google);
}

/**
 * Set up github auth
 */
function addGithubAuth(app) {
  const githubStrategy = new GitHubStrategy(githubSettings, processOAuthLogin);

  passport.use(githubStrategy);

  const github = Router();
  github.get(`/error`, (req, res) => res.send(`Unknown Error`));
  github.get(`/callback`, handleGithubCallback, (req, res) =>
    res.redirect(`/`)
  );
  github.get(`/logout`, logout);
  github.get(`/`, loginWithGithub);
  app.use(`/auth/github`, github);
}

/**
 * Set up magic link auth
 */
function addEmailAuth(app) {
  const magicStrategy = new MagicLoginStrategy(
    magicSettings,
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
    }
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
    }
  );

  magic.get(`/check`, function (req, res) {
    console.log(`user should check their email`);
    res.send(`For now, check the console for the link.`);
  });

  magic.get(
    `/verify`,
    passport.authenticate(`magiclink`, {
      successReturnToOrRedirect: `/`,
      failureRedirect: `/`,
    })
  );

  app.use(`/auth/email`, magic);
}
