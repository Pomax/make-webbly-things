import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { question, randomSecret, SETUP_ROOT_DIR } from "./utils.js";
import {
  setupGithubAuth,
  setupGoogleAuth,
  setupMastodonAuth,
} from "./auth-providers.js";

const BYPASS_TLS_QUESTIONS = process.argv.includes(`--no-tls`);

/**
 * (Re)generate the .env file that we need.
 */
export async function setupEnv(
  readFromENV = true,
  env = process.env,
  autoFill = {},
) {
  let {
    DOCKER_EXECUTABLE,
    LOCAL_DEV_TESTING,
    TLS_DNS_API_KEY,
    TLS_DNS_PROVIDER,
    USE_LIVE_EMBEDS,
    USE_WEBSOCKETS,
    WEB_EDITOR_APPS_HOSTNAME,
    WEB_EDITOR_HOSTNAME,
    WEB_EDITOR_IMAGE_NAME,
  } = readFromENV ? env : autoFill;

  // Do we need to do any host setup?
  if (!WEB_EDITOR_HOSTNAME || !WEB_EDITOR_APPS_HOSTNAME) {
    console.log(`
The system uses two domains, one for the editor website and one for
hosting projects. If you want to run this somewhere "on the web" you'll
need to provide hostnames so that things can be hooked up properly,
but even if you just want to run this locally, we'll need some "fake"
hostnames that Caddy can use to expose both the editor and running
project containers.
`);

    if (!WEB_EDITOR_HOSTNAME) {
      const defaultHost = `localhost`;
      WEB_EDITOR_HOSTNAME =
        (await question(
          `Web editor hostname (defaults to ${defaultHost})`,
          true,
          autoFill.WEB_EDITOR_HOSTNAME,
        )) || defaultHost;
    }

    if (!WEB_EDITOR_APPS_HOSTNAME) {
      const defaultAppHost = `app.localhost`;
      WEB_EDITOR_APPS_HOSTNAME =
        (await question(
          `Web app hostname (defaults to ${defaultAppHost})`,
          true,
          autoFill.WEB_EDITOR_APPS_HOSTNAME,
        )) || defaultAppHost;
    }
  }

  // Used to lock container-starts so only Caddy can trigger them:
  const WEB_EDITOR_APP_SECRET = randomSecret().replace(/\W/g, ``);

  if (!DOCKER_EXECUTABLE) {
    console.log(`
Projects are housed inside docker containers, which means we need
to know which tool is going to be managing those. The two common
tools for this are (obviously) docker itself, and podman, a newer
docker-compatible set of tools that are considered more secure,
as well as (at least for this platform) faster. As such:
`);
    const defaultDockerExecutable = `docker`;
    DOCKER_EXECUTABLE =
      (await question(
        `What is the name of your docker executable? (defaults to ${defaultDockerExecutable})`,
        true,
        autoFill.DOCKER_EXECUTABLE,
      )) || defaultDockerExecutable;
  }

  // Docker naming setup?
  if (!WEB_EDITOR_IMAGE_NAME) {
    console.log(`
All projects share the same base docker image. But that image needs
a name, and while the default name "local-base-image" might work
for most people, you may already have a Docker image by that name, so...
`);
    const defaultImage = `local-base-image`;
    WEB_EDITOR_IMAGE_NAME =
      (await question(
        `Please specify a base docker image name (defaults to ${defaultImage})`,
        true,
        autoFill.WEB_EDITOR_IMAGE_NAME,
      )) || defaultImage;
  }

  // Github login setup?
  const GITHUB_CALLBACK_URL = `https://${WEB_EDITOR_HOSTNAME}/auth/github/callback`;
  const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } = await setupGithubAuth(
    process.env,
    autoFill,
  );

  // Google login setup?
  const GOOGLE_CALLBACK_URL = `https://${WEB_EDITOR_HOSTNAME}/auth/google/callback`;
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = await setupGoogleAuth(
    process.env,
    autoFill,
  );

  // Mastodon login setup?
  const MASTODON_CALLBACK_URL = `https://${WEB_EDITOR_HOSTNAME}/auth/mastodon/callback`;
  const { MASTODON_OAUTH_DOMAIN, MASTODON_CLIENT_ID, MASTODON_CLIENT_SECRET } =
    await setupMastodonAuth(process.env, autoFill);

  // Is this a hosted instance?
  if (!BYPASS_TLS_QUESTIONS && !TLS_DNS_API_KEY) {
    TLS_DNS_PROVIDER = `false`;
    TLS_DNS_API_KEY = `false`;

    console.log(`
If you're running setup as part of a deployment, you will need to provide
caddy with the information it needs to negotiate DNS "ACME" connections.
This will require knowing your DNS provider and your API key for that provider.
`);

    const setupTLS = await question(
      `Add TLS information now? [y/n]`,
      false,
      autoFill.SETUP_TLS,
    );
    if (setupTLS.toLowerCase().startsWith(`y`)) {
      TLS_DNS_PROVIDER = await question(
        `TLS DNS provider (e.g. digitalocean)`,
        false,
        autoFill.TLS_DNS_PROVIDER,
      );

      TLS_DNS_API_KEY = await question(
        `TLS DNS provider API key`,
        false,
        autoFill.TLS_DNS_API_KEY,
      );
    }
  }

  LOCAL_DEV_TESTING = `${LOCAL_DEV_TESTING === true || LOCAL_DEV_TESTING === `true`}`;

  if (USE_WEBSOCKETS === undefined) {
    const defaulValue = `y`;
    USE_WEBSOCKETS =
      (await question(
        `Enable websockets [y/n] (defaults to ${defaulValue})`,
        true,
        autoFill.USE_WEBSOCKETS,
      )) || defaulValue;
    if (USE_WEBSOCKETS.toLowerCase().startsWith(`y`)) {
      USE_WEBSOCKETS = `true`;
    } else {
      USE_WEBSOCKETS = `false`;
    }
  }

  if (USE_LIVE_EMBEDS === undefined) {
    const defaulValue = `y`;
    USE_LIVE_EMBEDS =
      (await question(
        `Use live embeds [y/n] (defaults to ${defaulValue})`,
        true,
        autoFill.USE_LIVE_EMBEDS,
      )) || defaulValue;
    if (USE_LIVE_EMBEDS.toLowerCase().startsWith(`y`)) {
      USE_LIVE_EMBEDS = `true`;
    } else {
      USE_LIVE_EMBEDS = `false`;
    }
  }

  // (Re)generate the .env file
  writeFileSync(
    join(SETUP_ROOT_DIR, `.env`),
    `LOCAL_DEV_TESTING="${LOCAL_DEV_TESTING}"
DOCKER_EXECUTABLE="${DOCKER_EXECUTABLE}"
USE_WEBSOCKETS="${USE_WEBSOCKETS}"
USE_LIVE_EMBEDS="${USE_LIVE_EMBEDS}"

WEB_EDITOR_HOSTNAME="${WEB_EDITOR_HOSTNAME}"
WEB_EDITOR_APPS_HOSTNAME="${WEB_EDITOR_APPS_HOSTNAME}"
WEB_EDITOR_APP_SECRET="${WEB_EDITOR_APP_SECRET}"
WEB_EDITOR_IMAGE_NAME="${WEB_EDITOR_IMAGE_NAME}"

SESSION_SECRET="${randomSecret()}"
MAGIC_LINK_SECRET="${randomSecret()}"

GITHUB_CLIENT_ID="${GITHUB_CLIENT_ID || ``}"
GITHUB_CLIENT_SECRET="${GITHUB_CLIENT_SECRET || ``}"
GITHUB_CALLBACK_URL="${GITHUB_CALLBACK_URL || ``}"

GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID || ``}"
GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET || ``}"
GOOGLE_CALLBACK_URL="${GOOGLE_CALLBACK_URL || ``}"

MASTODON_OAUTH_DOMAIN="${MASTODON_OAUTH_DOMAIN || ``}"
MASTODON_CLIENT_ID="${MASTODON_CLIENT_ID || ``}"
MASTODON_CLIENT_SECRET="${MASTODON_CLIENT_SECRET || ``}"
MASTODON_CALLBACK_URL="${MASTODON_CALLBACK_URL || ``}"

TLS_DNS_PROVIDER="${TLS_DNS_PROVIDER}"
TLS_DNS_API_KEY="${TLS_DNS_API_KEY}"
`,
  );

  // And make sure to update process.env because subsequent
  // functions rely on having these variables set:
  Object.assign(env, {
    LOCAL_DEV_TESTING,
    DOCKER_EXECUTABLE,
    USE_WEBSOCKETS,
    USE_LIVE_EMBEDS,
    WEB_EDITOR_HOSTNAME,
    WEB_EDITOR_APPS_HOSTNAME,
    WEB_EDITOR_APP_SECRET,
    WEB_EDITOR_IMAGE_NAME,
    GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET,
    GITHUB_CALLBACK_URL,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_CALLBACK_URL,
    MASTODON_OAUTH_DOMAIN,
    MASTODON_CLIENT_ID,
    MASTODON_CLIENT_SECRET,
    MASTODON_CALLBACK_URL,
    TLS_DNS_PROVIDER,
    TLS_DNS_API_KEY,
  });
}
