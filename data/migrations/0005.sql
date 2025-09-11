-- Schema v6

ALTER TABLE user_logins ADD COLUMN service_domain TEXT;


PRAGMA user_version = 6;
