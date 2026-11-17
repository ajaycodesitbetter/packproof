-- Discovery snapshot cache: lets a cold-starting instance serve the last
-- good GitHub discovery snapshot instead of spending shared search quota.
-- Apply after 0001_library.sql on the same database:
--   turso db shell <database-name> < migrations/0002_discovery_cache.sql
CREATE TABLE IF NOT EXISTS discovery_cache (
  key TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);
