import { question } from "./utils.js";

const NO_AUTH_PROVIDERS = process.argv.includes(`--no-auth`);

/**
 * Set up GitHub as auth provider
 */
export async function setupGithubAuth(env, autoFill = {}) {
  // Are we already done?
  let { WEB_EDITOR_HOSTNAME } = env;
  let { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } = autoFill;

  GITHUB_CLIENT_ID ??= env.GITHUB_CLIENT_ID;
  GITHUB_CLIENT_SECRET ??= env.GITHUB_CLIENT_SECRET;

  if (GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET) {
    return { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET };
  }

  // If not, should we even do anything?
  if (NO_AUTH_PROVIDERS) return {};

  // We should. Ask the user if they want github authentication.
  const setup = await question(`\nSet up GitHub as auth provider (Y/n)`);
  if (setup.toLowerCase() === `n`) return {};

  console.log(`
In order to add GitHub as an auth provider, so you'll need to have
a GitHub application defined over on https://github.com/settings/developers

Create a new OAuth app if you don't have one already set up; for the
homepage url, give it "https://${WEB_EDITOR_HOSTNAME}", and as authorization
callback url, give it "https://${WEB_EDITOR_HOSTNAME}/auth/github/callback".

Once saved, generate a client secret, and then fill in the client id
and secrets here: they'll get saved to an untracked .env file that the
codebase will read in every time it starts up.
`);

  GITHUB_CLIENT_ID ??= await question(`Github client id`);
  GITHUB_CLIENT_SECRET ??= await question(`Github client secret`);

  return { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET };
}

/**
 * Set up Google as auth provider
 */
export async function setupGoogleAuth(env, autoFill = {}) {
  // Are we already done?
  let { WEB_EDITOR_HOSTNAME } = env;
  let { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = autoFill;

  GOOGLE_CLIENT_ID ??= env.GOOGLE_CLIENT_ID;
  GOOGLE_CLIENT_SECRET ??= env.GOOGLE_CLIENT_SECRET;

  if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
    return { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET };
  }

  // If not, should we even do anything?
  if (NO_AUTH_PROVIDERS) return {};

  // We should. Ask the user if they want google authentication.
  const setup = await question(`\nSet up Google as auth provider (Y/n)`);
  if (setup.toLowerCase() === `n`) return {};

  console.log(`
In order to add Google as an auth provider, so you'll need to have
a Google application defined over on https://console.cloud.google.com/apis/dashboard

Create a new OAuth app if you don't have one already set up, and then
create an OAuth client; for the
homepage url, give it "https://${WEB_EDITOR_HOSTNAME}", and as authorization
callback url, give it "https://${WEB_EDITOR_HOSTNAME}/auth/github/callback".

Once saved, generate a client secret, and then fill in the client id
and secrets here: they'll get saved to an untracked .env file that the
codebase will read in every time it starts up.
`);

  GOOGLE_CLIENT_ID ??= await question(`Google client id`);
  GOOGLE_CLIENT_SECRET ??= await question(`Google client secret`);

  return { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET };
}

/**
 * Add Mastodon as auth provider
 */
export async function setupMastodonAuth(env, autoFill = {}) {
  let { WEB_EDITOR_HOSTNAME } = env;

  let { MASTODON_OAUTH_DOMAIN, MASTODON_CLIENT_ID, MASTODON_CLIENT_SECRET } =
    autoFill;

  MASTODON_OAUTH_DOMAIN ??= env.MASTODON_OAUTH_DOMAIN;
  MASTODON_CLIENT_ID ??= env.MASTODON_CLIENT_ID;
  MASTODON_CLIENT_SECRET ??= env.MASTODON_CLIENT_SECRET;

  if (MASTODON_OAUTH_DOMAIN && MASTODON_CLIENT_ID && MASTODON_CLIENT_SECRET) {
    return {
      MASTODON_OAUTH_DOMAIN,
      MASTODON_CLIENT_ID,
      MASTODON_CLIENT_SECRET,
    };
  }

  // If not, should we even do anything?
  if (NO_AUTH_PROVIDERS) return {};

  // We should. Ask the user if they want google authentication.
  const setup = await question(`\nSet up Mastodon as auth provider (Y/n)`);
  if (setup.toLowerCase() === `n`) return {};

  console.log(`
In order to add Mastodon as an auth provider, so you'll need to have
an application defined on your chosen Mastodon instance, which you
can do by going to your preferences, then "Development", and
then picking "New application".

Create a new OAuth app if you don't have one already set up. For the
homepage url, give it "https://${WEB_EDITOR_HOSTNAME}", and as authorization
callback url, give it "https://${WEB_EDITOR_HOSTNAME}/auth/github/callback".

Once saved, fill in the client id and secret here: they'll get saved
to an untracked .env file that the codebase will read in every time
it starts up.
`);

  if (!MASTODON_OAUTH_DOMAIN) {
    const defaultDomain = `mastodon.social`;
    WEB_EDITOR_HOSTNAME =
      (await question(
        `Which mastodon instance (default to ${defaultDomain})`,
        true,
        autoFill.MASTODON_OAUTH_DOMAIN,
      )) || defaultDomain;
  }

  MASTODON_OAUTH_DOMAIN ??= MASTODON_CLIENT_ID =
    await question(`Mastodon client id`);

  MASTODON_CLIENT_SECRET ??= await question(`Mastodon client secret`);

  return { MASTODON_OAUTH_DOMAIN, MASTODON_CLIENT_ID, MASTODON_CLIENT_SECRET };
}
