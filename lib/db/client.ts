import Database from "better-sqlite3";
import path from "node:path";

export const databasePath = path.join(process.cwd(), "data", "sim.db");

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
  return db;
}
