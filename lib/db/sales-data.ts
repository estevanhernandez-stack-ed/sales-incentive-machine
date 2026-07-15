import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import { getDashboardData } from "./dashboard";

export const salesTemplateHeaders = ["check_reference", "opened_at", "server_name", "party_size", "subtotal", "item_name", "qty", "price_each", "note"];
type CsvRow = Record<string, string>;

function csvEscape(value: unknown) { let text = String(value ?? ""); if (/^[=+\-@]/.test(text)) text = `'${text}`; return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }

export function parseCsv(input: string): CsvRow[] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let index = 0; index < input.length; index += 1) { const character = input[index]; if (character === '"') { if (quoted && input[index + 1] === '"') { cell += '"'; index += 1; } else quoted = !quoted; } else if (character === "," && !quoted) { row.push(cell.trim()); cell = ""; } else if ((character === "\n" || character === "\r") && !quoted) { if (character === "\r" && input[index + 1] === "\n") index += 1; row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ""; } else cell += character; }
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) return [];
  if (quoted) throw new Error("CSV has an unclosed quoted value");
  const headers = rows[0].map((header, index) => (index === 0 ? header.replace(/^\uFEFF/, "") : header).toLowerCase());
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function number(value: string, label: string) { const parsed = Number(value); if (!Number.isFinite(parsed)) throw new Error(`${label} must be a number`); return parsed; }
function integer(value: string, label: string) { const parsed = number(value, label); if (!Number.isInteger(parsed)) throw new Error(`${label} must be a whole number`); return parsed; }
function timestamp(value: string) { const date = new Date(value); if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || Number.isNaN(date.getTime()) || date.toISOString() !== value) throw new Error("Opened at must be a valid ISO timestamp"); return value; }

export function importSalesCsv(db: Database.Database, fileName: string, csv: string) {
  const rows = parseCsv(csv); if (!rows.length) throw new Error("The file has no sales rows");
  const required = ["check_reference", "opened_at", "server_name", "party_size", "subtotal"];
  if (required.some((header) => !(header in rows[0]))) throw new Error(`CSV needs these columns: ${required.join(", ")}`);
  const servers = new Map((db.prepare("SELECT id, name FROM servers").all() as Array<{ id: number; name: string }>).map((server) => [server.name.toLowerCase(), server.id]));
  const menu = new Map((db.prepare("SELECT id, name, price FROM menu_items").all() as Array<{ id: number; name: string; price: number }>).map((item) => [item.name.toLowerCase(), item]));
  const grouped = new Map<string, CsvRow[]>(); rows.forEach((row, index) => { const reference = row.check_reference || `row-${index + 1}`; grouped.set(reference, [...(grouped.get(reference) ?? []), row]); });
  const transaction = db.transaction(() => {
    const hash = createHash("sha256").update(csv).digest("hex");
    if (db.prepare("SELECT 1 FROM data_imports WHERE content_hash = ?").get(hash)) throw new Error("This exact CSV was already imported");
    const importId = Number(db.prepare("INSERT INTO data_imports (file_name, imported_at, row_count, content_hash) VALUES (?, ?, ?, ?)").run(fileName, new Date().toISOString(), rows.length, hash).lastInsertRowid);
    let nextCheckId = (db.prepare("SELECT COALESCE(MAX(id), 0) + 1 AS id FROM checks").get() as { id: number }).id;
    let nextItemId = (db.prepare("SELECT COALESCE(MAX(id), 0) + 1 AS id FROM check_items").get() as { id: number }).id;
    for (const [reference, entries] of grouped) { if (/^\d+$/.test(reference) && db.prepare("SELECT 1 FROM checks WHERE id = ?").get(Number(reference))) throw new Error(`Check reference ${reference} already exists in this dataset`); const first = entries[0]; if (entries.some((entry) => ["opened_at", "server_name", "party_size", "subtotal", "note"].some((field) => entry[field] !== first[field]))) throw new Error(`Rows for ${reference} have inconsistent check details`); const serverId = servers.get(first.server_name.toLowerCase()); if (!serverId) throw new Error(`Unknown server: ${first.server_name}`); const partySize = integer(first.party_size, "Party size"); const subtotal = number(first.subtotal, "Subtotal"); const openedAt = timestamp(first.opened_at); if (partySize <= 0 || subtotal < 0) throw new Error(`Invalid check ${reference}`); const hasItems = entries.some((entry) => Boolean(entry.item_name)); if (hasItems && entries.some((entry) => !entry.item_name)) throw new Error(`Check ${reference} mixes itemized and check-only rows`); let itemRevenue = 0; const resolvedItems = entries.map((entry) => { if (!entry.item_name) return null; const item = menu.get(entry.item_name.toLowerCase()); if (!item) throw new Error(`Unknown menu item: ${entry.item_name}`); const qty = entry.qty ? integer(entry.qty, "Quantity") : 1; const price = entry.price_each ? number(entry.price_each, "Item price") : item.price; if (qty <= 0 || price < 0) throw new Error(`Invalid item on ${reference}`); itemRevenue += qty * price; return { item, qty, price }; }); if (hasItems && Math.abs(itemRevenue - subtotal) > 0.005) throw new Error(`Item revenue must equal subtotal for ${reference}`); db.prepare("INSERT INTO checks (id, server_id, opened_at, party_size, subtotal) VALUES (?, ?, ?, ?, ?)").run(nextCheckId, serverId, openedAt, partySize, subtotal); db.prepare("INSERT INTO sales_entry_audit (check_id, source_type, note, data_import_id, is_itemized) VALUES (?, 'imported', ?, ?, ?)").run(nextCheckId, first.note ?? "", importId, hasItems ? 1 : 0);
      for (const resolved of resolvedItems) if (resolved) db.prepare("INSERT INTO check_items (id, check_id, menu_item_id, qty, price_each) VALUES (?, ?, ?, ?, ?)").run(nextItemId++, nextCheckId, resolved.item.id, resolved.qty, resolved.price);
      nextCheckId += 1;
    }
    return { importedChecks: grouped.size, importedRows: rows.length };
  });
  return transaction();
}

export type SalesItemInput = { menuItemId: number; qty: number; priceEach: number };
export type SalesCheckCorrection = { checkId: number; serverId: number; openedAt: string; partySize: number; subtotal: number; note: string; items: SalesItemInput[] };

export function addManualSalesEntry(db: Database.Database, input: { serverId: number; openedAt: string; partySize: number; subtotal: number; note: string; items?: SalesItemInput[] }) {
  if (!Number.isInteger(input.serverId) || !Number.isInteger(input.partySize) || !Number.isFinite(input.subtotal) || input.partySize <= 0 || input.subtotal < 0) throw new Error("Enter a valid manual sales correction");
  timestamp(input.openedAt);
  const create = db.transaction(() => {
    const items = input.items ?? [];
    if (items.some((item) => !Number.isInteger(item.menuItemId) || !Number.isInteger(item.qty) || !Number.isFinite(item.priceEach) || item.menuItemId <= 0 || item.qty <= 0 || item.priceEach < 0)) throw new Error("Every item needs a menu item, whole quantity, and price");
    if (items.length && Math.abs(items.reduce((sum, item) => sum + item.qty * item.priceEach, 0) - input.subtotal) > 0.005) throw new Error("Item totals must equal the subtotal");
    const knownItems = new Set((db.prepare("SELECT id FROM menu_items").all() as Array<{ id: number }>).map((item) => item.id));
    if (items.some((item) => !knownItems.has(item.menuItemId))) throw new Error("Choose menu items from the current menu");
    const id = (db.prepare("SELECT COALESCE(MAX(id), 0) + 1 AS id FROM checks").get() as { id: number }).id;
    db.prepare("INSERT INTO checks (id, server_id, opened_at, party_size, subtotal) VALUES (?, ?, ?, ?, ?)").run(id, input.serverId, input.openedAt, input.partySize, input.subtotal);
    const nextItemId = (db.prepare("SELECT COALESCE(MAX(id), 0) + 1 AS id FROM check_items").get() as { id: number }).id;
    const insertItem = db.prepare("INSERT INTO check_items (id, check_id, menu_item_id, qty, price_each) VALUES (?, ?, ?, ?, ?)");
    items.forEach((item, index) => insertItem.run(nextItemId + index, id, item.menuItemId, item.qty, item.priceEach));
    db.prepare("INSERT INTO sales_entry_audit (check_id, source_type, note, is_itemized) VALUES (?, 'manual', ?, ?)").run(id, input.note, items.length ? 1 : 0);
    return id;
  });
  return create();
}

export function correctSalesCheck(db: Database.Database, input: SalesCheckCorrection) {
  if (!Number.isInteger(input.checkId) || !Number.isInteger(input.serverId) || !Number.isInteger(input.partySize) || !Number.isFinite(input.subtotal) || input.partySize <= 0 || input.subtotal < 0 || !input.note.trim()) throw new Error("Enter a valid correction and a reason");
  timestamp(input.openedAt);
  const correction = db.transaction(() => {
    const existing = db.prepare("SELECT id, server_id, opened_at, party_size, subtotal FROM checks WHERE id = ?").get(input.checkId) as { id: number; server_id: number; opened_at: string; party_size: number; subtotal: number } | undefined;
    if (!existing) throw new Error("That check no longer exists");
    if (!db.prepare("SELECT 1 FROM servers WHERE id = ? AND active = 1").get(input.serverId)) throw new Error("Choose an active server");
    const items = input.items.filter((item) => item.menuItemId > 0 || item.qty > 0 || item.priceEach > 0);
    if (items.some((item) => !Number.isInteger(item.menuItemId) || !Number.isInteger(item.qty) || !Number.isFinite(item.priceEach) || item.menuItemId <= 0 || item.qty <= 0 || item.priceEach < 0)) throw new Error("Every item needs a menu item, whole quantity, and price");
    if (items.length && Math.abs(items.reduce((sum, item) => sum + item.qty * item.priceEach, 0) - input.subtotal) > 0.005) throw new Error("Item totals must equal the corrected subtotal");
    const knownItems = new Set((db.prepare("SELECT id FROM menu_items").all() as Array<{ id: number }>).map((item) => item.id));
    if (items.some((item) => !knownItems.has(item.menuItemId))) throw new Error("Choose menu items from the current menu");
    const previousItems = db.prepare("SELECT menu_item_id, qty, price_each FROM check_items WHERE check_id = ? ORDER BY id").all(input.checkId);
    db.prepare("INSERT INTO sales_corrections (check_id, corrected_at, note, before_json) VALUES (?, ?, ?, ?)").run(input.checkId, new Date().toISOString(), input.note.trim(), JSON.stringify({ ...existing, items: previousItems }));
    db.prepare("UPDATE checks SET server_id = ?, opened_at = ?, party_size = ?, subtotal = ? WHERE id = ?").run(input.serverId, input.openedAt, input.partySize, input.subtotal, input.checkId);
    db.prepare("DELETE FROM check_items WHERE check_id = ?").run(input.checkId);
    const nextItemId = (db.prepare("SELECT COALESCE(MAX(id), 0) + 1 AS id FROM check_items").get() as { id: number }).id;
    const insertItem = db.prepare("INSERT INTO check_items (id, check_id, menu_item_id, qty, price_each) VALUES (?, ?, ?, ?, ?)");
    items.forEach((item, index) => insertItem.run(nextItemId + index, input.checkId, item.menuItemId, item.qty, item.priceEach));
    db.prepare("INSERT INTO sales_entry_audit (check_id, source_type, note, is_itemized) VALUES (?, 'corrected', ?, ?) ON CONFLICT(check_id) DO UPDATE SET source_type = 'corrected', note = excluded.note, is_itemized = excluded.is_itemized").run(input.checkId, input.note.trim(), items.length ? 1 : 0);
    return input.checkId;
  });
  return correction();
}

export function getSalesCsv(db: Database.Database) {
  const rows = db.prepare(`SELECT c.id AS check_reference, c.opened_at, s.name AS server_name, c.party_size, c.subtotal, m.name AS item_name, ci.qty, ci.price_each, COALESCE(sea.note, '') AS note FROM checks c JOIN servers s ON s.id = c.server_id LEFT JOIN check_items ci ON ci.check_id = c.id LEFT JOIN menu_items m ON m.id = ci.menu_item_id LEFT JOIN sales_entry_audit sea ON sea.check_id = c.id ORDER BY c.id, ci.id`).all() as Array<Record<string, unknown>>;
  return [salesTemplateHeaders.join(","), ...rows.map((row) => salesTemplateHeaders.map((header) => csvEscape(row[header])).join(","))].join("\n");
}

export function getSalesDataPageData(db: Database.Database, options: { query?: string; page?: number } = {}) {
  const query = options.query?.trim() ?? "";
  const requestedPage = Math.max(1, Math.floor(options.page ?? 1));
  const pageSize = 25;
  const where = query ? "WHERE (LOWER(s.name) LIKE LOWER(?) OR CAST(c.id AS TEXT) LIKE ? OR LOWER(COALESCE(sea.note, '')) LIKE LOWER(?) OR EXISTS (SELECT 1 FROM check_items search_ci JOIN menu_items search_m ON search_m.id = search_ci.menu_item_id WHERE search_ci.check_id = c.id AND LOWER(search_m.name) LIKE LOWER(?)))" : "";
  const searchParams = query ? [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`] : [];
  const totalChecks = (db.prepare(`SELECT COUNT(*) AS count FROM checks c JOIN servers s ON s.id = c.server_id LEFT JOIN sales_entry_audit sea ON sea.check_id = c.id ${where}`).get(...searchParams) as { count: number }).count;
  const pageCount = Math.max(1, Math.ceil(totalChecks / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const recentChecks = db.prepare(`SELECT c.id, c.server_id, c.opened_at, s.name AS server_name, c.party_size, c.subtotal, COALESCE(sea.source_type, 'seed') AS source_type, COALESCE(sea.is_itemized, 1) AS is_itemized, COALESCE(sea.note, '') AS note, COUNT(ci.id) AS item_rows FROM checks c JOIN servers s ON s.id = c.server_id LEFT JOIN sales_entry_audit sea ON sea.check_id = c.id LEFT JOIN check_items ci ON ci.check_id = c.id ${where} GROUP BY c.id ORDER BY c.opened_at DESC, c.id DESC LIMIT ? OFFSET ?`).all(...searchParams, pageSize, (page - 1) * pageSize) as Array<{ id: number; server_id: number; opened_at: string; server_name: string; party_size: number; subtotal: number; source_type: "seed" | "imported" | "manual" | "corrected"; is_itemized: number; note: string; item_rows: number }>;
  const itemsForCheck = db.prepare("SELECT ci.menu_item_id, m.name AS menu_item_name, ci.qty, ci.price_each FROM check_items ci JOIN menu_items m ON m.id = ci.menu_item_id WHERE ci.check_id = ? ORDER BY ci.id");
  const dashboard = getDashboardData(db);
  const performanceMetrics = dashboard?.metrics.filter((metric) => ["ppa::", "avg_check::", "alcohol_pct::", "attach_rate:app:", "attach_rate:dessert:"].includes(metric.id)) ?? [];
  return { query, page, pageCount, pageSize, totalChecks, totalDatasetChecks: (db.prepare("SELECT COUNT(*) AS count FROM checks").get() as { count: number }).count, servers: db.prepare("SELECT id, name FROM servers WHERE active = 1 ORDER BY name").all() as Array<{ id: number; name: string }>, menuItems: db.prepare("SELECT id, name, price FROM menu_items ORDER BY category, name").all() as Array<{ id: number; name: string; price: number }>, imports: db.prepare("SELECT file_name, imported_at, row_count FROM data_imports ORDER BY imported_at DESC LIMIT 8").all() as Array<{ file_name: string; imported_at: string; row_count: number }>, manualCount: (db.prepare("SELECT COUNT(*) AS count FROM sales_corrections").get() as { count: number }).count, performanceMetrics, serverPerformance: dashboard?.leaderboard ?? [], contestGoalCount: dashboard?.contest.goals.length ?? 0, recentChecks: recentChecks.map((check) => ({ ...check, items: itemsForCheck.all(check.id) as Array<{ menu_item_id: number; menu_item_name: string; qty: number; price_each: number }> })) };
}
