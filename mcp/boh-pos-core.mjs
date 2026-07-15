import Database from "better-sqlite3";
import path from "node:path";

const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function openPosDatabase(filename) {
  const db = new Database(filename);
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(`CREATE TABLE IF NOT EXISTS synthetic_pos_receipts (
    id INTEGER PRIMARY KEY,
    external_reference TEXT NOT NULL UNIQUE,
    source_label TEXT NOT NULL,
    check_id INTEGER NOT NULL UNIQUE REFERENCES checks(id) ON DELETE CASCADE,
    received_at TEXT NOT NULL
  ); CREATE INDEX IF NOT EXISTS synthetic_pos_receipts_received_idx ON synthetic_pos_receipts(received_at);`);
  return db;
}

function integer(value, label, minimum = 1) {
  if (!Number.isInteger(value) || value < minimum) throw new Error(`${label} must be a whole number of at least ${minimum}.`);
  return value;
}

function text(value, label, maximum = 120) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) throw new Error(`${label} must be between 1 and ${maximum} characters.`);
  return value.trim();
}

function timestamp(value) {
  if (typeof value !== "string" || !isoPattern.test(value) || new Date(value).toISOString() !== value) throw new Error("opened_at must be an exact UTC ISO timestamp, including milliseconds.");
  return value;
}

export function getCatalog(db) {
  return {
    synthetic_only: true,
    servers: db.prepare("SELECT id, name FROM servers WHERE active = 1 ORDER BY name").all(),
    menu_items: db.prepare("SELECT id, name, category, price, is_alcohol FROM menu_items ORDER BY category, name").all(),
    active_contest: db.prepare("SELECT id, name, week_start FROM contests WHERE status = 'active' ORDER BY week_start DESC LIMIT 1").get() ?? null,
  };
}

function validateCheck(db, input) {
  const externalReference = text(input?.external_reference, "external_reference", 80);
  const serverId = integer(input?.server_id, "server_id");
  const openedAt = timestamp(input?.opened_at);
  const partySize = integer(input?.party_size, "party_size");
  const note = input?.note === undefined ? "" : text(input.note, "note", 160);
  if (!db.prepare("SELECT 1 FROM servers WHERE id = ? AND active = 1").get(serverId)) throw new Error("server_id must reference an active synthetic SIM server.");
  if (!Array.isArray(input?.items) || input.items.length < 1 || input.items.length > 50) throw new Error("items must contain between 1 and 50 item lines.");
  const menuLookup = db.prepare("SELECT id, name, price FROM menu_items WHERE id = ?");
  const items = input.items.map((line, index) => {
    const menuItemId = integer(line?.menu_item_id, `items[${index}].menu_item_id`);
    const qty = integer(line?.qty, `items[${index}].qty`);
    const menuItem = menuLookup.get(menuItemId);
    if (!menuItem) throw new Error(`items[${index}].menu_item_id is not in SIM's synthetic menu.`);
    return { menu_item_id: menuItem.id, name: menuItem.name, qty, price_each: menuItem.price };
  });
  const subtotal = Number(items.reduce((sum, item) => sum + item.qty * item.price_each, 0).toFixed(2));
  return { external_reference: externalReference, server_id: serverId, opened_at: openedAt, party_size: partySize, note, items, subtotal };
}

function insertValidatedCheck(db, input, sourceLabel) {
  const existing = db.prepare("SELECT check_id FROM synthetic_pos_receipts WHERE external_reference = ?").get(input.external_reference);
  if (existing) return { check_id: existing.check_id, external_reference: input.external_reference, duplicate: true, subtotal: input.subtotal };
  const checkId = db.prepare("SELECT COALESCE(MAX(id), 0) + 1 AS id FROM checks").get().id;
  let itemId = db.prepare("SELECT COALESCE(MAX(id), 0) + 1 AS id FROM check_items").get().id;
  db.prepare("INSERT INTO checks (id, server_id, opened_at, party_size, subtotal) VALUES (?, ?, ?, ?, ?)").run(checkId, input.server_id, input.opened_at, input.party_size, input.subtotal);
  const insertItem = db.prepare("INSERT INTO check_items (id, check_id, menu_item_id, qty, price_each) VALUES (?, ?, ?, ?, ?)");
  for (const item of input.items) insertItem.run(itemId++, checkId, item.menu_item_id, item.qty, item.price_each);
  const auditNote = [`Synthetic BOH POS: ${sourceLabel}`, input.note].filter(Boolean).join(" · ");
  db.prepare("INSERT INTO sales_entry_audit (check_id, source_type, note, is_itemized) VALUES (?, 'imported', ?, 1)").run(checkId, auditNote);
  db.prepare("INSERT INTO synthetic_pos_receipts (external_reference, source_label, check_id, received_at) VALUES (?, ?, ?, ?)").run(input.external_reference, sourceLabel, checkId, new Date().toISOString());
  return { check_id: checkId, external_reference: input.external_reference, duplicate: false, subtotal: input.subtotal, item_lines: input.items.length };
}

export function recordCheck(db, raw, defaultSource = "agent-boh-pos") {
  const sourceLabel = raw?.source_label === undefined ? defaultSource : text(raw.source_label, "source_label", 60);
  const validated = validateCheck(db, raw);
  return db.transaction(() => insertValidatedCheck(db, validated, sourceLabel)).immediate();
}

export function recordShift(db, raw) {
  const sourceLabel = text(raw?.source_label, "source_label", 60);
  if (!Array.isArray(raw?.checks) || raw.checks.length < 1 || raw.checks.length > 100) throw new Error("checks must contain between 1 and 100 closed checks.");
  const validated = raw.checks.map((check) => validateCheck(db, check));
  const references = validated.map((check) => check.external_reference);
  if (new Set(references).size !== references.length) throw new Error("A shift cannot repeat an external_reference.");
  return db.transaction(() => {
    const receipts = validated.map((check) => insertValidatedCheck(db, check, sourceLabel));
    return { source_label: sourceLabel, received: receipts.length, inserted: receipts.filter((receipt) => !receipt.duplicate).length, duplicates: receipts.filter((receipt) => receipt.duplicate).length, subtotal: Number(receipts.reduce((sum, receipt) => sum + receipt.subtotal, 0).toFixed(2)), receipts };
  }).immediate();
}

export function getRecentReceipts(db, raw = {}) {
  const limit = raw.limit === undefined ? 20 : integer(raw.limit, "limit");
  if (limit > 100) throw new Error("limit cannot exceed 100.");
  return db.prepare(`SELECT spr.external_reference, spr.source_label, spr.received_at, c.id AS check_id, c.opened_at, c.party_size, c.subtotal, s.name AS server_name, COUNT(ci.id) AS item_lines
    FROM synthetic_pos_receipts spr JOIN checks c ON c.id = spr.check_id JOIN servers s ON s.id = c.server_id LEFT JOIN check_items ci ON ci.check_id = c.id
    GROUP BY spr.id ORDER BY spr.received_at DESC, spr.id DESC LIMIT ?`).all(limit);
}

export function defaultDatabasePath(serverFileUrl) {
  return path.join(path.dirname(new URL(serverFileUrl).pathname.replace(/^\/(.:)/, "$1")), "..", "data", "sim.db");
}
