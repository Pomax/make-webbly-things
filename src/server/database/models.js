import sqlite3 from "better-sqlite3";
import { join, dirname } from "node:path";
import { composeWhere } from "./utils.js";
import { scrubDateTime, readContentDir } from "../../helpers.js";

const DEBUG_SQL = false;

// not quite a fan of this, so this solution may change in the future:
export const UNKNOWN_USER = -1;
export const NOT_ACTIVATED = -2;
export const ADMIN = 100; // full access on all the things.
export const OWNER = 30; // full access, can delete projects
export const EDITOR = 20; // edit access, cannot delete projects, can edit project settings
export const MEMBER = 10; // edit access, cannot edit project settings

// We're in ./src/server/database, and we want ./data
const dbPath = `${import.meta.dirname}/../../../data/data.sqlite3`;
const db = sqlite3(dbPath);
db.pragma(`foreign_keys = ON`);

/**
 * Are we on the right version of the database?
 */
export async function getMigrationStatus() {
  let version = db.prepare(`PRAGMA user_version`).get().user_version;
  const migrations = (await readContentDir(join(dirname(dbPath), `migrations`)))
    .map((v) => parseFloat(v.match(/\d+/)?.[0]))
    .filter(Boolean);
  const last = (migrations.at(-1) ?? 0) + 1;
  return last - version;
}

/**
 * Generic "run me this SQL" function, because sometimes you need complex queries.
 */
export function runQuery(sql, values = []) {
  if (DEBUG_SQL) console.log(`RUN QUERY`, sql, values);
  return db.prepare(sql).all(...values);
}

/**
 * Let's define a generic model class, because we're just making things work right now.
 */
class Model {
  constructor(table, primaryKey = `id`) {
    this.table = table;
    this.primaryKey = primaryKey;
  }

  /**
   * Get me all records. You get a choice in ordering, but
   * you probably want to make sure that you're not using
   * this with a million-row table or the like =D
   */
  all(sortKeys, sortDir = `ASC`) {
    if (sortKeys && !sortKeys.map) sortKeys = [sortKeys];
    let sql = `SELECT * FROM ${this.table}`;
    if (sortKeys) {
      sql = `${sql} ORDER BY ${sortKeys.join(`,`)} ${sortDir}`;
    }
    return db.prepare(sql).all();
  }

  /**
   * Create a new record in this table. Does a find() first, to
   * make sure you're not trying to create a record that already
   * exists. If that happens, you generally want to update your
   * code to use findOrCreate instead in that codepath.
   */
  create(where = {}) {
    if (DEBUG_SQL) console.log(`CREATE with`, where);
    const record = this.find(where);
    if (record) throw new Error(`record already exists`);
    this.insert(where);
    return this.find(where);
  }

  /**
   * I hope you're sure, because there's no undelete.
   * I also hope you remembered to specify "where" constraints,
   * because if you didn't, your table WILL BE EMPTY after
   * this call completes, which is almost certainly not what
   * you were trying to do!!!
   */
  delete(where) {
    const { filter, values } = composeWhere(where);
    const sql = `DELETE FROM ${this.table} WHERE ${filter}`;
    if (DEBUG_SQL) console.log(`DELETE`, sql, values);
    return db.prepare(sql).run(values);
  }

  /**
   * This one should be self-explanatory. Find a record.
   */
  find(where) {
    return this.findAll(where)[0];
  }

  /**
   * This all records that match our where criteria.
   */
  findAll(where) {
    const { filter, values } = composeWhere(where);
    const sql = `SELECT * FROM ${this.table} WHERE ${filter}`;
    if (DEBUG_SQL) console.log(`FIND`, sql, values);
    return db.prepare(sql).all(values).filter(Boolean);
  }

  /**
   * Does what it says in the function name.
   */
  findOrCreate(where = {}) {
    const row = this.find(where);
    if (row) return row;
    this.insert(where);
    return this.find(where);
  }

  /**
   * Insert a record into this table, using the column values
   * in the colVals object. Columns that, in the database, have
   * a default value may be left off.
   */
  insert(colVals) {
    const keys = Object.keys(colVals);
    const values = Object.values(colVals);
    const sql = `INSERT INTO ${this.table} (${keys.join(`,`)}) VALUES (${keys.map((v) => `?`).join(`,`)})`;
    if (DEBUG_SQL) console.log(`INSERT`, sql, values);
    db.prepare(sql).run(...values);
  }

  /**
   * Save a record - if the primary key is not "id", you
   * will need to explicitly specify it as second argument.
   */
  save(record) {
    const { primaryKey } = this;
    const pval = record[primaryKey];
    delete record[primaryKey];
    if (record.updated_at)
      record.updated_at = scrubDateTime(new Date().toISOString());
    const update = Object.keys(record)
      .map((k) => `${k} = ?`)
      .join(`, `);
    const values = Object.values(record);
    const sql = `UPDATE ${this.table} SET ${update} WHERE ${primaryKey} = ?`;
    if (DEBUG_SQL) console.log(`UPDATE`, sql, values);
    db.prepare(sql).run(...values, pval);
    record[primaryKey] = pval;
  }
}

// And then let's create some models!
export const Models = {
  Access: new Model(`project_access`), // TODO: how do we do compound keys?
  Admin: new Model(`admin_table`, `user_id`),
  Login: new Model(`user_logins`), // <- same here
  Project: new Model(`projects`, `id`),
  ProjectSettings: new Model(`project_settings`, `project_id`),
  ProjectSuspension: new Model(`suspended_projects`, `id`),
  Remix: new Model(`remix`, `project_id`),
  StarterProject: new Model(`starter_projects`, `project_id`),
  User: new Model(`users`, `id`),
  UserSuspension: new Model(`suspended_users`, `id`),
};
