import { join } from "node:path";

// Explicit env loading as we rely on env
// at the module's top level scope...
import dotenv from "@dotenvx/dotenvx";
const envPath = join(import.meta.dirname, `../../../../.env`);
dotenv.config({ path: envPath, quiet: true });
const { env } = process;

const testing = env.LOCAL_DEVTESTING === `true`;

export const githubSettings = env.GITHUB_CLIENT_ID
  ? {
      clientID: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      callbackURL: env.GITHUB_CALLBACK_URL,
      passReqToCallback: true,
    }
  : undefined;

export const googleSettings = env.GOOGLE_CLIENT_ID
  ? {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL,
      passReqToCallback: true,
    }
  : undefined;

export const magicSettings =
  testing && env.MAGIC_LINK_SECRET
    ? {
        secret: env.MAGIC_LINK_SECRET,
        userFields: ["email"],
        tokenField: "token",
        verifyUserAfterToken: true,
      }
    : undefined;

export const mastodonSettings = env.MASTODON_CLIENT_ID
  ? {
      clientID: env.MASTODON_CLIENT_ID,
      clientSecret: env.MASTODON_CLIENT_SECRET,
      callbackURL: env.MASTODON_CALLBACK_URL,
      domain: env.MASTODON_OAUTH_DOMAIN,
      passReqToCallback: true,
    }
  : undefined;

/**
 * Which providers do we offer?
 */
export const validProviders = [];
if (testing && magicSettings) validProviders.push(`email`);
if (githubSettings) validProviders.push(`github`);
if (googleSettings) validProviders.push(`google`);
if (mastodonSettings) validProviders.push(`mastodon`);

console.log(`Auth providers: ${validProviders.join(`, `)}`);
