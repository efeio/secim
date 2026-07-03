import db from "./db";

db.exec(`
  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    actor TEXT,
    payload TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

export function logAudit(action: string, actor: string, payload?: object): void {
  db.prepare(
    "INSERT INTO audit_logs (action, actor, payload) VALUES (?, ?, ?)"
  ).run(action, actor, payload ? JSON.stringify(payload) : null);
}

export function getAuditLogs(limit: number = 100): { id: number; action: string; actor: string; payload: string | null; created_at: string }[] {
  return db.prepare(
    "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?"
  ).all(limit) as { id: number; action: string; actor: string; payload: string | null; created_at: string }[];
}
