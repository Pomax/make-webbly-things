import sqlite3 from "better-sqlite3";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { slugify } from "../helpers.js";
import { applyMigrations } from "../server/database/utils.js";
import { SETUP_ROOT_DIR } from "./utils.js";

const dbPath = join(SETUP_ROOT_DIR, `data`, `data.sqlite3`);
mkdirSync(dirname(dbPath), { recursive: true });

/**
 * If we have sqlite3 available, check to see if there's a data.sqlite3
 * database file in the right place, and if not, create it.
 */
export async function setupSqlite() {
  // Make sure both the primary and test dbs are at the right version
  await applyMigrations(dbPath);

  // Make sure all the starters from the content/__starter_projects have
  // database entries, and that the database is up to date with respect
  // to whatever is in each starter's settings.json file.

  const db = sqlite3(dbPath);
  const starterDir = join(SETUP_ROOT_DIR, `content`, `__starter_projects`);
  const starters = readdirSync(starterDir)
    .filter((v) => !v.includes(`.`))
    .filter((v) => !v.startsWith(`__`));

  await Promise.all(
    starters.map((name) => {
      const starterContainerDir = join(starterDir, name, `.container`);
      const settingsFile = join(starterContainerDir, `settings.json`);
      const runsh = join(starterContainerDir, `run.sh`);

      const slug = slugify(name);
      const settings = JSON.parse(readFileSync(settingsFile).toString());
      const {
        name: starterName,
        description,
        run_script,
        env_vars,
        default_file,
        default_collapse,
        app_type,
        root_dir,
      } = settings;

      writeFileSync(runsh, run_script);

      // Create or update the project record:
      let result = db
        .prepare(`SELECT * FROM projects WHERE slug = ?`)
        .get(slug);
      if (!result) {
        db.prepare(
          `INSERT INTO projects (name, slug, description) VALUES (?, ?, ?)`,
        ).run(starterName, slug, description);
        result = db.prepare(`SELECT * FROM projects WHERE name = ?`).get(name);
        const { id } = result;
        db.prepare(
          `INSERT INTO project_settings (project_id, default_file, default_collapse, run_script, env_vars, app_type, root_dir) VALUES (?,?,?,?,?,?,?)`,
        ).run(
          id,
          default_file ?? ``,
          default_collapse ?? ``,
          run_script,
          env_vars ?? ``,
          app_type,
          root_dir,
        );
        db.prepare(`INSERT INTO starter_projects (project_id) VALUES (?)`).run(
          id,
        );
      } else {
        const { id } = result;
        db.prepare(`UPDATE projects SET name=?, description=? WHERE id=?`).run(
          starterName,
          description,
          id,
        );
        db.prepare(
          `UPDATE project_settings SET default_file=?, default_collapse=?, run_script=?, env_vars=?, app_type=?, root_dir=? WHERE project_id=?`,
        ).run(
          default_file ?? ``,
          default_collapse ?? ``,
          run_script,
          env_vars ?? ``,
          app_type,
          root_dir,
          id,
        );
      }
    }),
  );

  // and lastly:
  db.close();
}
