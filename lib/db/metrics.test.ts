import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getHouseMetric, getMetric } from "./metrics";
import { goalMetricDefinition, qualifiesForGoal } from "./dashboard";

function fixture() {
  const db = new Database(":memory:");
  db.exec(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
  db.exec("INSERT INTO servers VALUES (1, 'Server A', '#111111', 1), (2, 'Server B', '#222222', 1)");
  db.exec("INSERT INTO menu_items VALUES (1, 'Sunset Fizz', 'cocktail', 10, 1), (2, 'Crisp Tart', 'dessert', 6, 0), (3, 'Garden Plate', 'entree', 14, 0)");
  db.exec("INSERT INTO checks VALUES (1, 1, '2026-07-01T10:00:00Z', 2, 30), (2, 1, '2026-07-01T11:00:00Z', 6, 60), (3, 2, '2026-07-01T12:00:00Z', 2, 20)");
  db.exec("INSERT INTO check_items VALUES (1, 1, 1, 1, 10), (2, 1, 3, 1, 14), (3, 2, 2, 2, 6), (4, 2, 3, 1, 14), (5, 3, 3, 1, 14)");
  return db;
}

describe("restaurant metrics", () => {
  it("uses check subtotal for PPA and average check", () => {
    const db = fixture();
    expect(getMetric(db, { metric: "ppa" }, 1)).toBe(11.25);
    expect(getMetric(db, { metric: "avg_check" }, 1)).toBe(45);
  });

  it("calculates alcohol, category/item attachment, item count, and large-party PPA", () => {
    const db = fixture();
    expect(getMetric(db, { metric: "alcohol_pct" }, 1)).toBeCloseTo(10 / 90);
    expect(getMetric(db, { metric: "attach_rate", category: "dessert" }, 1)).toBe(0.5);
    expect(getMetric(db, { metric: "attach_rate", menuItemId: 1 }, 1)).toBe(0.5);
    expect(getMetric(db, { metric: "item_count", menuItemId: 2 }, 1)).toBe(2);
    expect(getMetric(db, { metric: "large_party_ppa" }, 1)).toBe(10);
    expect(getHouseMetric(db, { metric: "avg_check" })).toBeCloseTo(110 / 3);
  });

  it("adds active contest tallies only to that contest's item count", () => {
    const db = fixture();
    db.exec("INSERT INTO contests VALUES (1, 'Dessert Push', '2026-07-13', '{}', 'active', 'manual'); INSERT INTO contest_score_entries VALUES (1, 1, 1, 2, 3, '2026-07-13T20:00:00.000Z', 'Live tally')");
    expect(getMetric(db, { metric: "item_count", menuItemId: 2 }, 1)).toBe(2);
    expect(getMetric(db, { metric: "item_count", menuItemId: 2 }, 1, 1)).toBe(5);
    expect(getMetric(db, { metric: "ppa" }, 1, 1)).toBe(11.25);
  });

  it("qualifies threshold goals inclusively and house goals strictly", () => {
    expect(qualifiesForGoal(0.32, 0.4, { metric: "attach_rate", category: "app", threshold: 0.32 })).toBe(true);
    expect(qualifiesForGoal(0.4, 0.4, { metric: "alcohol_pct", vs_house: true })).toBe(false);
    expect(qualifiesForGoal(0.41, 0.4, { metric: "alcohol_pct", vs_house: true })).toBe(true);
    expect(goalMetricDefinition({ metric: "item_count", menu_item_id: 2, threshold: 1 })).toEqual({ metric: "item_count", category: undefined, menuItemId: 2 });
  });
});
