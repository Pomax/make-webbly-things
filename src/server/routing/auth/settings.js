const { env } = process;

const LOCAL_DEV = env.LOCAL_DEVTESTING === `true`;

const settings = {};

export const githubSettings = (settings[`github`] = env.GITHUB_CLIENT_ID
  ? {
      clientID: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      callbackURL: env.GITHUB_CALLBACK_URL,
      passReqToCallback: true,
    }
  : undefined);

export const googleSettings = (settings[`google`] = env.GOOGLE_CLIENT_ID
  ? {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL,
      passReqToCallback: true,
    }
  : undefined);

export const magicSettings = (settings[`email`] =
  LOCAL_DEV && env.MAGIC_LINK_SECRET
    ? {
        secret: env.MAGIC_LINK_SECRET,
        userFields: ["email"],
        tokenField: "token",
        verifyUserAfterToken: true,
      }
    : undefined);

export const mastodonSettings = (settings[`mastodon`] = env.MASTODON_CLIENT_ID
  ? {
      clientID: env.MASTODON_CLIENT_ID,
      clientSecret: env.MASTODON_CLIENT_SECRET,
      callbackURL: env.MASTODON_CALLBACK_URL,
      domain: env.MASTODON_OAUTH_DOMAIN,
      passReqToCallback: true,
    }
  : undefined);

/**
 * ...docs go here...
 */
export function getServiceDomain(provider) {
  return settings[provider]?.domain;
}

/**
 * Ensure that the CSP directives cover auth methods
 * for provided that rely on the formAction directive.
 */
export function updateCSPDirectives(directives) {
  if (githubSettings) directives.formAction += ` https://github.com`;
  if (googleSettings) directives.formAction += ` https://accounts.google.com`;
}

/**
 * Which providers do we offer?
 */
export const validProviders = [];
if (LOCAL_DEV && magicSettings) validProviders.push(`email`);
if (githubSettings) validProviders.push(`github`);
if (googleSettings) validProviders.push(`google`);
if (mastodonSettings) validProviders.push(`mastodon`);
