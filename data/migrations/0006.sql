-- Schema v7

ALTER TABLE admin_table ADD COLUMN is_superuser INTEGER NOT NULL DEFAULT 0;


PRAGMA user_version = 7;
