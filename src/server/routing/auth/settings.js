import { join } from "node:path";

// Explicit env loading as we rely on env
// at the module's top level scope...
import dotenv from "@dotenvx/dotenvx";
const envPath = join(import.meta.dirname, `../../../../.env`);
dotenv.config({ path: envPath, quiet: true });
const { env } = process;

export const googleSettings = {
  clientID: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  callbackURL: env.GOOGLE_CALLBACK_URL,
  // We need accss to req.session during auth,
  // because signup vs. signin has different
  // values stored in the request session.
  passReqToCallback: true,
};

export const githubSettings = {
  clientID: env.GITHUB_CLIENT_ID,
  clientSecret: env.GITHUB_CLIENT_SECRET,
  callbackURL: env.GITHUB_CALLBACK_URL,
  // We need accss to req.session during auth,
  // because signup vs. signin has different
  // values stored in the request session.
  passReqToCallback: true,
};

export const magicSettings = {
  secret: env.MAGIC_LINK_SECRET,
  userFields: ["email"],
  tokenField: "token",
  verifyUserAfterToken: true,
};
