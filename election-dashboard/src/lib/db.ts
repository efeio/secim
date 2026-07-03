import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "election.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");
db.pragma("synchronous = NORMAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS polls (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'tr',
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'active', 'ended')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at TEXT
  );

  CREATE TABLE IF NOT EXISTS candidates (
    id TEXT PRIMARY KEY,
    poll_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#888888',
    photo_url TEXT,
    FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS votes (
    id TEXT PRIMARY KEY,
    poll_id TEXT NOT NULL,
    candidate_id TEXT NOT NULL,
    province_code TEXT NOT NULL,
    device_token TEXT NOT NULL,
    ip_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
  );

  -- Composite indexes for high-performance aggregation queries
  CREATE INDEX IF NOT EXISTS idx_votes_poll_province ON votes(poll_id, province_code);
  CREATE INDEX IF NOT EXISTS idx_votes_poll_candidate ON votes(poll_id, candidate_id);
  CREATE INDEX IF NOT EXISTS idx_votes_poll_device ON votes(poll_id, device_token);
  CREATE INDEX IF NOT EXISTS idx_votes_poll_ip ON votes(poll_id, ip_hash);
  CREATE INDEX IF NOT EXISTS idx_votes_created ON votes(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_votes_poll_created ON votes(poll_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_polls_status ON polls(status);
  CREATE INDEX IF NOT EXISTS idx_candidates_poll ON candidates(poll_id);
`);

// Migration: add country column if not exists
try {
  db.exec(`ALTER TABLE polls ADD COLUMN country TEXT NOT NULL DEFAULT 'tr'`);
} catch {}

// Migration: add color2 column to candidates
try {
  db.exec(`ALTER TABLE candidates ADD COLUMN color2 TEXT`);
} catch {}

export default db;
