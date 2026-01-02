CREATE TABLE IF NOT EXISTS subscribers (
  email TEXT PRIMARY KEY,
  location_lat REAL NOT NULL,
  location_lon REAL NOT NULL,
  location_name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  frequency TEXT NOT NULL DEFAULT 'daily',
  confirmed INTEGER NOT NULL DEFAULT 0,
  subscribed INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  confirm_token TEXT
);

CREATE INDEX idx_subscribers_confirmed ON subscribers(confirmed, subscribed);