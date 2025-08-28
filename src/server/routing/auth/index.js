import { Router } from "express";
import { passport } from "./middleware.js";
import { Strategy as GitHubStrategy } from "passport-github2";
import { Strategy as MagicLoginStrategy } from "passport-magic-link";
import { loginWithGithub, handleGithubCallback, logout } from "./middleware.js";
import { processUserLogin } from "../../database/index.js";

// Explicit env loading as we rely on process.env
// at the module's top level scope...
import dotenv from "@dotenvx/dotenvx";
dotenv.config({ quiet: true });

const githubSettings = {
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: process.env.GITHUB_CALLBACK_URL,
};

const magicSettings = {
  secret: process.env.MAGIC_LINK_SECRET,
  userFields: ["email"],
  tokenField: "token",
  verifyUserAfterToken: true,
};

export function addPassportAuth(app) {
  app.use(passport.initialize());
  app.use(passport.session());
  addGithubAuth(app);
  addEmailAuth(app);
}

/**
 * Set up github auth
 */
function addGithubAuth(app) {
  const githubStrategy = new GitHubStrategy(
    githubSettings,
    (accessToken, refreshToken, profile, done) => {
      const user = {
        userName: profile.displayName,
        service: profile.provider,
        service_id: profile.id,
      };
      console.log(`running processUserLogin`);
      return done(null, processUserLogin(user));
    }
  );

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
      const url = `https://${process.env.WEB_EDITOR_HOSTNAME}/auth/email/verify?token=${token}`;
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
