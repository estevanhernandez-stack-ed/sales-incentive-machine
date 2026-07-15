import Database from "better-sqlite3";
import path from "node:path";

export const databasePath = path.join(process.cwd(), "data", "sim.db");

export function openDatabase(filename = databasePath) {
  const db = new Database(filename);
  db.pragma("foreign_keys = ON");
  return db;
}
