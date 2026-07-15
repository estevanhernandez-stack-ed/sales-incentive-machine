import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getCatalog, getRecentReceipts, recordCheck, recordShift } from "./boh-pos-core.mjs";

function fixture() {
  const db = new Database(":memory:");
  db.exec(readFileSync(new URL("../lib/db/schema.sql", import.meta.url), "utf8"));
  db.exec("INSERT INTO servers VALUES (1, 'Avery Moss', '#d97706', 1); INSERT INTO menu_items VALUES (1, 'Ember Corn Cups', 'app', 8, 0); INSERT INTO menu_items VALUES (2, 'Signal Fizz', 'na_bev', 4, 0); INSERT INTO contests VALUES (1, 'Signal Sprint', '2026-07-13', '{}', 'active', 'manual')");
  return db;
}

const check = { external_reference: "FAKE-1001", server_id: 1, opened_at: "2026-07-14T18:00:00.000Z", party_size: 2, items: [{ menu_item_id: 1, qty: 2 }, { menu_item_id: 2, qty: 1 }] };

describe("synthetic BOH POS MCP core", () => {
  it("exposes only the seeded fake catalog", () => {
    const db = fixture();
    expect(getCatalog(db)).toMatchObject({ synthetic_only: true, servers: [{ id: 1, name: "Avery Moss" }], active_contest: { id: 1 } });
  });

  it("derives prices, records an itemized audit, and makes retries idempotent", () => {
    const db = fixture();
    expect(recordCheck(db, check)).toMatchObject({ check_id: 1, subtotal: 20, duplicate: false, item_lines: 2 });
    expect(recordCheck(db, check)).toMatchObject({ check_id: 1, duplicate: true });
    expect(db.prepare("SELECT COUNT(*) AS count FROM checks").get()).toEqual({ count: 1 });
    expect(db.prepare("SELECT source_type, is_itemized FROM sales_entry_audit").get()).toEqual({ source_type: "imported", is_itemized: 1 });
    expect(getRecentReceipts(db)).toHaveLength(1);
  });

  it("rejects an invalid shift atomically", () => {
    const db = fixture();
    expect(() => recordShift(db, { source_label: "fake-dinner", checks: [check, { ...check, external_reference: "FAKE-1002", server_id: 99 }] })).toThrow("active synthetic");
    expect(db.prepare("SELECT COUNT(*) AS count FROM checks").get()).toEqual({ count: 0 });
  });
});
