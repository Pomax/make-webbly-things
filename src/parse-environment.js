import { existsSync, readFileSync } from "node:fs";

export const NO_UPDATE = Symbol(`do not update process.env`);

export function parseEnvironment(envFile = `.env`, updatePolicy) {
  console.log(`Using ${envFile}`);
  if (existsSync(envFile)) {
    const data = readFileSync(envFile).toString();
    const entries = Object.fromEntries(
      data
        .split(`\n`)
        .filter(Boolean)
        .map((e) => e.split(`=`).map((v) => v.trim().replaceAll(`"`, ``))),
    );
    if (updatePolicy !== NO_UPDATE) {
      Object.entries(entries).forEach(([k, v]) => (process.env[k] = v));
    }
    return entries;
  }
}
