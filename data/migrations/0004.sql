-- Schema v5

CREATE TABLE IF NOT EXISTS user_links (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INTEGER DEFAULT -1 
);

PRAGMA user_version = 5;
