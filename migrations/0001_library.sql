-- PackProof per-user library. One row per (user, pack) save: writes are
-- single-row INSERT OR IGNORE / DELETE, which are atomic and idempotent, so
-- concurrent saves of different packs both land and duplicate saves converge
-- with no read-modify-write race.
CREATE TABLE IF NOT EXISTS library_saves (
  user_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, slug)
);
