CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  state TEXT NOT NULL,
  player_count INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_updated ON sessions(updated_at DESC);
