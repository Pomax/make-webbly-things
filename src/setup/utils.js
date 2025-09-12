import readline from "node:readline";
import { execSync } from "node:child_process";

// used by the question() helper
const stdin = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// used by various execSync operations
export const STDIO = process.argv.includes(`--debug`) ? `inherit` : `ignore`;

// Rather important for testing:
export function closeReader() {
  stdin.close();
}

/**
 * Generic "see if this command works" code.
 */
export function checkFor(cmd, missing = []) {
  try {
    return execSync(`${cmd} --version`, { env: process.env }).toString().trim();
  } catch (e) {
    missing.push(cmd);
    console.log(e);
    console.error(`Command "${cmd}" does not appear to be available`);
  }
}

/**
 * Verify that the node version used matches the package.json requirement
 */
export async function checkNodeVersion() {
  const packageJson = (
    await import(`${import.meta.url}/../../../package.json`, {
      with: {
        type: `json`,
      },
    })
  ).default;
  // Pretty crucial:
  const minimum = parseFloat(packageJson.engines.node.match(/\d+(\.|$)/)[0]);
  const v = checkFor(`node`);
  const m = v.match(/v(\d+)/)[1];
  const version = parseFloat(m);
  if (version < minimum) {
    throw console.error(`This platform requires node v${minimum} or newer`);
  }
}

/**
 * A little wrapper function so we can ask questions that may,
 * or may not, accept empty answers.
 */
export async function question(q, allowEmpty = false) {
  return new Promise((resolve) => {
    stdin.question(`${q}? `, (value) => {
      value = value.trim();
      if (value || allowEmpty) return resolve(value);
      resolve(question(q));
    });
  });
}

/**
 * A little helper function for generating random
 * secrets for session and magic link purposes
 */
export function randomSecret() {
  let randomSecret = ``;
  while (randomSecret.length < 40) {
    randomSecret += String.fromCharCode(
      0x30 + (((0x7a - 0x30) * Math.random()) | 0),
    );
  }
  return randomSecret;
}

/**
 * Make sure dependencies are installed.
 */
export function runNpmInstall() {
  execSync(`npm i`, { shell: true, stdio: `inherit` });
}
