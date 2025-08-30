-- Schema v2

ALTER TABLE project_settings ADD COLUMN app_type TEXT DEFAULT 'static';
ALTER TABLE project_settings ADD COLUMN root_dir TEXT DEFAULT NULL;

PRAGMA user_version = 2;
