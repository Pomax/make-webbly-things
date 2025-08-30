-- we shouldn't need this but let's say it anyway:

PRAGMA encoding = "UTF-8";

-- make sure foreign constraints are enforced:

PRAGMA foreign_keys = ON;

-- users

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  enabled_at TEXT
);

CREATE INDEX IF NOT EXISTS user_names ON users(name);

CREATE TABLE IF NOT EXISTS admin_table (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
);

-- oauth links so we can look up users based on their passport object

CREATE TABLE IF NOT EXISTS user_logins (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  service TEXT NOT NULL,
  service_id TEXT NO NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS login_services ON user_logins(service, service_id);

-- user suspension

CREATE TABLE IF NOT EXISTS suspended_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  suspended_at TEXT DEFAULT CURRENT_TIMESTAMP,
  reason TEXT,
  notes TEXT,
  invalidated_at TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS suspended_user_names ON suspended_users(user_id);

-- projects

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS project_names ON projects(name);
CREATE INDEX IF NOT EXISTS project_slugs ON projects(slug);

CREATE TABLE IF NOT EXISTS starter_projects (
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE
);

-- remixes

CREATE TABLE IF NOT EXISTS remix (
  original_id INTEGER,
  project_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS remix_ids ON remix(original_id, project_id);

-- project settings

CREATE TABLE IF NOT EXISTS project_settings (
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  default_file TEXT,
  default_collapse TEXT,
  run_script TEXT,
  env_vars TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS container_ids ON project_settings(project_id);

-- project suspension

CREATE TABLE IF NOT EXISTS suspended_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  suspended_at TEXT DEFAULT CURRENT_TIMESTAMP,
  reason TEXT,
  notes TEXT,
  invalidated_at TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS suspended_project_names ON suspended_projects(project_id);

-- project access

CREATE TABLE IF NOT EXISTS project_access_levels (
  access_level INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_access (
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE NO ACTION,
  access_level INTEGER NOT NULL DEFAULT 30 REFERENCES project_access_levels(access_level) ON DELETE NO ACTION,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS access_users ON project_access(user_id);

-- default data

INSERT OR IGNORE INTO project_access_levels (access_level, name) VALUES (30, 'owner');
INSERT OR IGNORE INTO project_access_levels (access_level, name) VALUES (25, 'editor');
INSERT OR IGNORE INTO project_access_levels (access_level, name) VALUES (20, 'member');
INSERT OR IGNORE INTO project_access_levels (access_level, name) VALUES (10, 'viewer');

-- Schema v1

PRAGMA user_version = 1;
