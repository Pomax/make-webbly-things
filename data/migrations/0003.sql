-- Schema v4

ALTER TABLE users ADD COLUMN bio TEXT DEFAULT '';

PRAGMA user_version = 4;
