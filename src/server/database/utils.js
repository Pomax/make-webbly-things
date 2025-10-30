import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { basename, dirname, join } from "node:path";
import {
  cpSync,
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import * as Helpers from "../../helpers.js";
import sqlite3 from "better-sqlite3";
import { randomUUID } from "node:crypto";
const { readContentDir, TESTING } = Helpers;

/**
 * Uplift a database, based on its `user_version` pragma,
 * and number of migration files in the migration dir.
 */
export async function applyMigrations(dbPath) {
  const dbDir = dirname(dbPath);

  // First, which version is this db on?
  const db = sqlite3(dbPath);
  let version = db.prepare(`PRAGMA user_version`).get().user_version;
  db.close();

  // Do we need to bootstrap this db? (note that this may include
  // simply creating a missing table, not rebuilding the full db)
  if (!version) {
    const baseline = join(dbDir, `schema.sql`);
    execSync(`sqlite3 ${dbPath} ".read ${baseline}"`);
    version = 1;
  }

  // Do we need to run any migrations?
  const migrationDir = join(dbDir, `migrations`);
  const { files } = readContentDir(migrationDir);
  const migrations = files
    .map((v) => parseFloat(v.match(/\d+/)[0]))
    .sort((a, b) => a - b);

  const last = migrations.at(-1);
  if (version <= last) {
    for (; version <= last; version++) {
      const migration = `${version}`.padStart(4, `0`);
      const sqlPath = join(migrationDir, `${migration}.sql`);
      const jsPath = join(migrationDir, `${migration}.js`);

      // Are we dealing with a sql migration? If so, just apply it
      if (existsSync(sqlPath)) {
        if (!TESTING) console.log(`- applying ${sqlPath}`);
        execSync(`sqlite3 ${dbPath} ".read ${sqlPath}"`);
      }

      // If not, is it a JS migration? If so, run it.
      else if (existsSync(jsPath)) {
        if (!TESTING) console.log(`- applying ${jsPath}`);
        await migrate(dbPath, jsPath, version);
      }

      // If not... uh... what? What is this?
      else {
        console.error(`
There appears to be an invalid migration file (${migration}) in ./data/migrations?

Please have a look at what's going on there: I'm erroring out now.
`);
        process.exit(1);
      }
    }
  }
  if (!TESTING)
    console.log(`Database ${basename(dbPath)} is at version ${version}`);
}

/**
 * ...docs go here...
 */
export function composeWhere(where, suffix = []) {
  const ua = where.updated_at;
  if (where.updated_at) delete where.updated_at;
  let filter = Object.entries(where)
    .map(([k, v]) => {
      if (v === null || v === undefined) {
        suffix.push(`${k} IS NULL`);
        return false;
      }
      return `${k} = ?`;
    })
    .filter(Boolean)
    .join(` AND `);
  if (suffix.length) filter += ` AND ${suffix.join(` AND `)}`;
  const values = Object.values(where).filter(
    (v) => !(v === undefined || v === null),
  );
  if (ua) where.updated_at = ua;
  return { filter, values };
}

/**
 * ...docs go here...
 */
export async function migrate(dbPath, migrationScript, migrationNumber) {
  const dir = dirname(dbPath);
  const file = basename(dbPath);
  const sqlTmpPath = join(dir, `${randomUUID()}.data.sql`);
  const oldDb = join(dir, `v${migrationNumber}.${file}`);
  rmSync(sqlTmpPath, { force: true });
  execSync(`sqlite3 ${dbPath} .dump > ${sqlTmpPath}`);
  let data = readFileSync(sqlTmpPath)
    .toString(`utf-8`)
    .replaceAll(/\r\n/g, `\n`);
  const update = await import(pathToFileURL(migrationScript)).then(
    (lib) => lib.default,
  );
  data =
    (await update(data, Helpers)) +
    `\nPRAGMA user_version = ${migrationNumber + 1};\n`;
  writeFileSync(sqlTmpPath, data);
  await new Promise((resolve) => setTimeout(resolve, 500));
  cpSync(dbPath, oldDb);
  rmSync(dbPath);
  execSync(`sqlite3 ${dbPath} ".read ${sqlTmpPath}"`);
  await new Promise((resolve) => setTimeout(resolve, 500));
  rmSync(sqlTmpPath);
}
