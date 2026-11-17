-- Cross-instance coordination for GitHub discovery quota (lib/discovery-coord.ts).
-- Single-row ledger: per-minute upstream call budget shared across all
-- instances, refresh lease with owner, and chunked refresh progress.
CREATE TABLE IF NOT EXISTS discovery_coord (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  window_bucket INTEGER NOT NULL DEFAULT 0,
  window_calls INTEGER NOT NULL DEFAULT 0,
  lease_until INTEGER NOT NULL DEFAULT 0,
  lease_owner TEXT NOT NULL DEFAULT '',
  progress_next INTEGER NOT NULL DEFAULT 0,
  progress_payload TEXT NOT NULL DEFAULT '[]'
);
INSERT OR IGNORE INTO discovery_coord
  (id, window_bucket, window_calls, lease_until, lease_owner, progress_next, progress_payload)
  VALUES (1, 0, 0, 0, '', 0, '[]');
