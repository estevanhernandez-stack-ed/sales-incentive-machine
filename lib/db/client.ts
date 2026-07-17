import Database from "better-sqlite3";
import path from "node:path";

export const databasePath = path.resolve(process.env.SIM_DATABASE_PATH ?? path.join(process.cwd(), "data", "sim.db"));

export function openDatabase(filename = databasePath) {
  const db = new Database(filename);
  db.pragma("foreign_keys = ON");
  db.exec(`CREATE TABLE IF NOT EXISTS contest_score_entries (
    id INTEGER PRIMARY KEY,
    contest_id INTEGER NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
    server_id INTEGER NOT NULL REFERENCES servers(id),
    menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    entered_at TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS contest_score_entries_contest_server_idx ON contest_score_entries(contest_id, server_id, menu_item_id);`);
  db.exec(`CREATE TABLE IF NOT EXISTS operation_receipts (
    operation_id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    expected_contest_id INTEGER,
    request_hash TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('applied', 'already_applied')),
    response_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS operation_receipts_created_at_idx ON operation_receipts(created_at DESC);
  CREATE INDEX IF NOT EXISTS operation_receipts_role_created_at_idx ON operation_receipts(actor_role, created_at DESC);`);
  return db;
}
