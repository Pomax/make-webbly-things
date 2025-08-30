/**
 * The "browser based web editor" setup script. This script:
 *
 * - will run npm install to make sure the code can run,
 * - checks whether or not you have docker, caddy, and sqlite3 installed
 * - If you don't, it'll do nothing.
 * - If you do, it'll set up the docker base image that is used for projects,
 * - set up a Caddyfile for this project that gets used for host routing, and
 * - set up the database that the code relies on for housing user/project/etc data.
 */

import readline from "node:readline";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import sqlite3 from "better-sqlite3";
import { setupCaddy } from "./src/server/caddy/caddy.js";
import { pathExists, readContentDir, slugify } from "./src/helpers.js";
import dotenv from "@dotenvx/dotenvx";
dotenv.config({ quiet: true });

const stdin = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const STDIO = process.argv.includes(`--debug`) ? `inherit` : `ignore`;
const dbPath = `./data/data.sqlite3`;
const BYPASS_FINISH = pathExists(dbPath);
const DOCKER_MAINTENANCE = process.argv.includes(`--clean`);
const noop = () => {};

const filePath = fileURLToPath(import.meta.url);
const moduleDir = dirname(filePath);
if (filePath.startsWith(process.argv[1])) {
  setup(
    () => {
      // Pretty crucial:
      const minimum = 22;
      const v = checkFor(`node`);
      const m = v.match(/v(\d+)/)[1];
      const version = parseFloat(m);
      if (version < minimum) {
        console.error(`This platform requires node v${minimum} or newer`);
        throw "";
      }
    },
    runNpmInstall,
    checkDependencies,
    setupEnv,
    setupDocker,
    DOCKER_MAINTENANCE ? noop : () => setupCaddy(process.env),
    DOCKER_MAINTENANCE ? noop : setupSqlite
  );
}

// ---------------------------------------------------------------------------
//  Functions get hoisted at load time, so we can declare them after our call
// ---------------------------------------------------------------------------

// A little wrapper function so we can ask questions that may,
// or may not, accept empty answers.
async function question(q, allowEmpty = false) {
  return new Promise((resolve) => {
    stdin.question(`${q}? `, (value) => {
      value = value.trim();
      if (value || allowEmpty) return resolve(value);
      resolve(question(q));
    });
  });
}

// Then, a little helper function for generating
// random secrets for session and magic link purposes:
function randomSecret() {
  let randomSecret = ``;
  while (randomSecret.length < 40) {
    randomSecret += String.fromCharCode(
      0x30 + (((0x7a - 0x30) * Math.random()) | 0)
    );
  }
  return randomSecret;
}

/**
 * This is a utility function that just runs through a series of functions
 * and if none of them throw, setup was a success. If even a single one
 * throws, then setup is halted and you get informed about that failure.
 */
async function setup(...handlers) {
  try {
    while (handlers.length) {
      await handlers.shift()();
    }

    // If we run setup after we already have a database set up,
    // folks probably don't want the first-time-setup,
    // first-login-becomes-admin functionality, so don't
    // create the file that triggers that:
    if (BYPASS_FINISH) {
      console.log(`
Setup complete.

Run "npm start", log in, and have fun!
`);
    }

    // If there was no database yet, though, make sure that when
    // the user first logs into the system, their login immediately
    // enables the user account, and flips the admin switch for it.
    else {
      const token = `${Math.random()}`.substring(2);
      writeFileSync(join(moduleDir, `.finish-setup`), token);

      console.log(`
Setup complete.

Run "npm start", and log in using GitHub. This will create
the initial (enabled and admin) user account with which to
do everything else.
`);
    }

    process.exit(0);
  } catch (e) {
    console.log(e);
    console.log(`\nSetup incomplete. Please review the errors.\n`);
    process.exit(1);
  }
}

/**
 * Install all npm dependencies for this codebase.
 */
function runNpmInstall() {
  execSync(`npm i`, { shell: true, stdio: STDIO });
}

/**
 * Verify we have all the tools necessary to run the codebase.
 */
function checkDependencies() {
  const missing = [];
  checkForGit(missing);
  checkForDocker(missing);
  checkForCaddy(missing);
  checkForSqlite(missing);
  if (missing.length) {
    throw new Error(`Missing dependencies: ${missing.join(`, `)}`);
  }
}

/**
 * Generic "see if this command works" code.
 */
function checkFor(cmd, missing = []) {
  try {
    return execSync(`${cmd} --version`, { env: process.env }).toString().trim();
  } catch (e) {
    missing.push(cmd);
    console.log(e);
    console.error(`Command "${cmd}" does not appear to be available`);
  }
}

/**
 * Make sure we have git installed.
 */
function checkForGit(missing) {
  checkFor(`git`, missing);
}

/**
 * Check if the docker command works, and if it does, whether or not
 * docker engine is running, because the docker CLI can't work without
 * that running in the background.
 */
function checkForDocker(missing) {
  checkFor(`docker`, missing);
  try {
    execSync(`docker ps`, { shell: true, stdio: STDIO });
    return true;
  } catch (e) {
    console.error(`Docker is avaiable, but docker engine is not running.`);
  }
}

/**
 * Is caddy installed?
 */
function checkForCaddy(missing) {
  return checkFor(`caddy`, missing);
}

/**
 * Is sqlite3 installed?
 */
function checkForSqlite(missing) {
  return checkFor(`sqlite3`, missing);
}

/**
 * (Re)generate the .env file that we need.
 */
async function setupEnv() {
  let {
    WEB_EDITOR_HOSTNAME,
    WEB_EDITOR_APPS_HOSTNAME,
    WEB_EDITOR_IMAGE_NAME,
    GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET,
    GITHUB_APP_HOST,
    GITHUB_CALLBACK_URL,
    TLS_DNS_PROVIDER,
    TLS_DNS_API_KEY,
  } = process.env;

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
      let defaultHost = `editor.com.localhost`;
      WEB_EDITOR_HOSTNAME =
        (await question(
          `Web editor hostname (defaults to ${defaultHost})`,
          true
        )) || defaultHost;
    }

    if (!WEB_EDITOR_APPS_HOSTNAME) {
      const defaultAppHost = `app.localhost`;
      WEB_EDITOR_APPS_HOSTNAME =
        (await question(
          `Web app hostname (defaults to ${defaultAppHost})`,
          true
        )) || defaultAppHost;
    }
  }

  // Used to lock container-starts so only Caddy can trigger them:
  const WEB_EDITOR_APP_SECRET = randomSecret().replace(/\W/g, ``);

  // Docker naming setup?
  if (!WEB_EDITOR_IMAGE_NAME) {
    console.log(`
Projects are housed inside docker containers, and to speed up the
build time, all project containers are built off of single base
Docker image. But that image needs a name, and while the default
name "local-base-image" might work for most people, you may already
have a Docker image by that name, so...
`);
    const defaultImage = `local-base-image`;
    WEB_EDITOR_IMAGE_NAME =
      (await question(
        `Base docker image name (defaults to ${defaultImage})`,
        true
      )) || defaultImage;
  }

  // Github login setup?
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    console.log(`
For now, we're using GitHub as our oauth mediator, so you'll need to have
a GitHub application defined over on https://github.com/settings/developers

Create a new OAuth app if you don't have one already set up; for the
homepage url, give it "https://${WEB_EDITOR_HOSTNAME}", and as authorization
callback url, give it "https://${WEB_EDITOR_HOSTNAME}/auth/github/callback".

Once saved, generate a client secret, and then fill in the client id
and secrets here: they'll get saved to an untracked .env file that the
codebase will read in every time it starts up.
`);

    GITHUB_CLIENT_ID = await question(`Github client id`);
    GITHUB_CLIENT_SECRET = await question(`Github client secret`);
  }

  GITHUB_APP_HOST = `https://\${WEB_EDITOR_HOSTNAME}`;
  GITHUB_CALLBACK_URL = `https://\${WEB_EDITOR_HOSTNAME}/auth/github/callback`;

  if (!TLS_DNS_API_KEY) {
    TLS_DNS_PROVIDER = `false`;
    TLS_DNS_API_KEY = `false`;

    console.log(`
If you're running setup as part of a deployment, you will need to provide
caddy with the information it needs to negotiate DNS "ACME" connections.
This will require knowing your DNS provider and your API key for that provider.
`);

    const setupTLS = await question(`Add TLS information now? [y/n]`);
    if (setupTLS.toLowerCase().startsWith(`y`)) {
      TLS_DNS_PROVIDER = await question(`TLS DNS provider (e.g. digitalocean)`);
      TLS_DNS_API_KEY = await question(`TLS DNS provider API key`);
    }
  }

  // (Re)generate the .env file
  writeFileSync(
    join(moduleDir, `.env`),
    `LOCAL_DEV_TESTING=true
WEB_EDITOR_HOSTNAME="${WEB_EDITOR_HOSTNAME}"
WEB_EDITOR_APPS_HOSTNAME="${WEB_EDITOR_APPS_HOSTNAME}"
WEB_EDITOR_APP_SECRET="${WEB_EDITOR_APP_SECRET}"
WEB_EDITOR_IMAGE_NAME="${WEB_EDITOR_IMAGE_NAME}"
SESSION_SECRET="${randomSecret()}"
MAGIC_LINK_SECRET="${randomSecret()}"
GITHUB_CLIENT_ID="${GITHUB_CLIENT_ID}"
GITHUB_CLIENT_SECRET="${GITHUB_CLIENT_SECRET}"
GITHUB_APP_HOST="${GITHUB_APP_HOST}"
GITHUB_CALLBACK_URL="${GITHUB_CALLBACK_URL}"
TLS_DNS_PROVIDER="${TLS_DNS_PROVIDER}"
TLS_DNS_API_KEY="${TLS_DNS_API_KEY}"
`
  );

  // And make sure to update process.env because subsequent
  // functions rely on having these variables set:
  Object.assign(process.env, {
    WEB_EDITOR_HOSTNAME,
    WEB_EDITOR_APPS_HOSTNAME,
    WEB_EDITOR_APP_SECRET,
    WEB_EDITOR_IMAGE_NAME,
    GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET,
    GITHUB_APP_HOST,
    GITHUB_CALLBACK_URL,
    TLS_DNS_PROVIDER,
    TLS_DNS_API_KEY,
  });
}

/**
 * If we have docker available, check to see if the base image that
 * the codebase needs already exists, and if not, build it.
 */
function setupDocker() {
  const { WEB_EDITOR_IMAGE_NAME } = process.env;

  if (DOCKER_MAINTENANCE) {
    console.log(`\n- Cleaning up docker images...`);

    // clean up anything unrelated to currently running containers
    execSync(`docker system prune -a -f`, {
      shell: true,
      stdio: STDIO,
    });

    console.log(`- Generating an updated ${WEB_EDITOR_IMAGE_NAME}...`);

    // generate a new version of the base image
    execSync(`docker build -t ${WEB_EDITOR_IMAGE_NAME} .`, {
      shell: true,
      cwd: `./src/server/docker`,
      stdio: STDIO,
    });

    console.log(`Done.`);

    return;
  }

  try {
    execSync(`docker image inspect ${WEB_EDITOR_IMAGE_NAME}`, {
      shell: true,
      stdio: STDIO,
    });
  } catch (e) {
    execSync(`docker build -t ${WEB_EDITOR_IMAGE_NAME} .`, {
      shell: true,
      cwd: `./src/server/docker`,
      stdio: STDIO,
    });
  }
  writeFileSync(
    join(moduleDir, `Dockerfile`),
    `FROM ${WEB_EDITOR_IMAGE_NAME}:latest
CMD sh .container/run.sh
`
  );
}

/**
 * If we have sqlite3 available, check to see if there's a data.sqlite3
 * database file in the right place, and if not, create it.
 */
async function setupSqlite() {
  // Make sure all the starters from the content/__starter_projects have
  // database entries, and that the database is up to date with respect
  // to whatever is in each starter's settings.json file.

  const db = sqlite3(dbPath);
  let version = db.prepare(`PRAGMA user_version`).get().user_version;

  // Do we need to bootstrap the db? (note that this may include
  // simply creating a missing table, not rebuilding the full db)
  if (version === 0) {
    execSync(`sqlite3 ${dbPath} ".read ./data/schema.sql"`);
  }

  // Do we need to run any migrations?
  const migrations = (await readContentDir(`./data/migrations`)).map((v) =>
    parseFloat(v.match(/\d+/)[0])
  );
  const last = migrations.at(-1);
  for (; version <= last; version++) {
    const migration = `${version}`.padStart(4, `0`);
    execSync(`sqlite3 ${dbPath} ".read ./data/migrations/${migration}.sql"`);
  }
  console.log(`Database is at version ${version}`);

  const starterDir = `./content/__starter_projects`;
  const starters = readdirSync(starterDir)
    .filter((v) => !v.includes(`.`))
    .filter((v) => !v.startsWith(`__`));

  starters.forEach((name) => {
    const settingsFile = join(
      moduleDir,
      starterDir,
      name,
      `.container`,
      `settings.json`
    );
    const slug = slugify(name);
    const settings = JSON.parse(readFileSync(settingsFile).toString());
    const { description, run_script, default_file, default_collapse } =
      settings;

    // Create or update the project record:
    let result = db.prepare(`SELECT * FROM projects WHERE name = ?`).get(name);
    if (!result) {
      db.prepare(
        `INSERT INTO projects (name, slug, description) VALUES (?, ?, ?)`
      ).run(name, slug, description);
      result = db.prepare(`SELECT * FROM projects WHERE name = ?`).get(name);
      const { id } = result;
      db.prepare(
        `INSERT INTO project_settings (project_id, default_file, default_collapse, run_script) VALUES (?,?,?,?)`
      ).run(id, default_file ?? ``, default_collapse ?? ``, run_script);
      db.prepare(`INSERT INTO starter_projects (project_id) VALUES (?)`).run(
        id
      );
    } else {
      const { id } = result;
      db.prepare(`UPDATE projects SET description=? WHERE id=?`).run(
        description,
        id
      );
      db.prepare(
        `UPDATE project_settings SET default_file=?, default_collapse=?, run_script=? WHERE project_id=?`
      ).run(default_file ?? ``, default_collapse ?? ``, run_script, id);
    }
  });
}
