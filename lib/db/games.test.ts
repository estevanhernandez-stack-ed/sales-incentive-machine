import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { awardMenuMission, lockSalesRace } from "./games";
import { getWheelData } from "./wheel";

function fixture() {
  const db = new Database(":memory:"); db.exec(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
  db.exec("INSERT INTO servers VALUES (1, 'Avery Moss', '#d97706', 1), (2, 'Blair Rowan', '#be123c', 1)");
  db.exec("INSERT INTO menu_items VALUES (1, 'Ember Corn Cups', 'app', 8, 0), (18, 'Cocoa Pot', 'dessert', 9, 0)");
  db.exec("INSERT INTO checks VALUES (1, 1, '2026-07-13T18:00:00.000Z', 2, 67), (2, 2, '2026-07-13T18:00:00.000Z', 2, 33)");
  db.exec("INSERT INTO check_items VALUES (1, 1, 1, 5, 8), (2, 1, 18, 3, 9), (3, 2, 1, 3, 8), (4, 2, 18, 1, 9)");
  const config = JSON.stringify({ goals: [], bingo_pool: Array.from({ length: 24 }, (_, index) => index + 1), entry_rules: { per_goal_met: 1, per_bingo_win: 1 }, prize: "Friday off", games: [{ id: "race", type: "sales_race", title: "Ember Rush", metric: { metric: "item_count", menu_item_id: 1 }, entries_by_place: [3, 2] }, { id: "mission", type: "menu_mission", title: "Sweet Finish", objectives: [{ metric: "item_count", menu_item_id: 1, threshold: 4 }, { metric: "item_count", menu_item_id: 18, threshold: 3 }], entries_on_completion: 2 }] });
  db.exec(`INSERT INTO contests VALUES (1, 'Signal Sprint', '2026-07-13', '${config}', 'active', 'manual')`); return db;
}
describe("sales games", () => {
  it("locks a live race once, awards missions once, and feeds the wheel", () => { const db = fixture(); expect(lockSalesRace(db, "race").map((entry) => entry.serverId)).toEqual([1, 2]); expect(() => lockSalesRace(db, "race")).toThrow("already locked"); expect(awardMenuMission(db, "mission")).toEqual([1]); expect(awardMenuMission(db, "mission")).toEqual([]); expect(getWheelData(db)?.entries.map((entry) => ({ id: entry.serverId, entries: entry.entries }))).toEqual([{ id: 1, entries: 5 }, { id: 2, entries: 2 }]); });
});
