import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { drawWeightedWinner, getWheelData } from "./wheel";

function fixture() {
  const db = new Database(":memory:");
  db.exec(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
  db.exec("INSERT INTO servers VALUES (1, 'Avery Moss', '#d97706', 1), (2, 'Blair Rowan', '#be123c', 1)");
  db.exec("INSERT INTO checks VALUES (1, 1, '2026-07-13T17:00:00.000Z', 4, 100), (2, 2, '2026-07-13T17:00:00.000Z', 3, 60)");
  const config = JSON.stringify({ goals: [{ metric: "ppa", threshold: 20 }], bingo_pool: Array.from({ length: 24 }, (_, index) => index + 1), entry_rules: { per_goal_met: 2, per_bingo_win: 3 }, prize: "Friday night off" });
  db.exec(`INSERT INTO contests VALUES (1, 'Signal Sprint', '2026-07-13', '${config}', 'active', 'manual')`);
  db.exec("INSERT INTO bingo_cards VALUES (1, 1, 1, '[1,2,3,4,5,6,7,8,9,10,11,12,\"FREE\",13,14,15,16,17,18,19,20,21,22,23,24]', '2026-07-13T16:00:00.000Z')");
  db.exec("INSERT INTO bingo_submissions VALUES (1, 1, '2026-07-13T20:00:00.000Z', '[0,1,2,3,4,12]', 1, 3)");
  return db;
}

describe("prize wheel", () => {
  it("combines live goal qualifications and bingo entries", () => {
    const data = getWheelData(fixture());
    expect(data?.entries.map(({ name, entries, goalsMet, dailyWins }) => ({ name, entries, goalsMet, dailyWins }))).toEqual([
      { name: "Avery Moss", entries: 5, goalsMet: 1, dailyWins: 1 },
      { name: "Blair Rowan", entries: 2, goalsMet: 1, dailyWins: 0 },
    ]);
    expect(data?.entries[0]).toMatchObject({
      entryBreakdown: { goals: 2, bingo: 3, games: 0 },
      performance: { ppa: 25, avgCheck: 100 },
      goalStats: [{ label: "Per-person average", value: 25, target: "$20.00", qualified: true, metric: "ppa" }],
    });
  });

  it("selects a winner using entry-weighted ranges", () => {
    const entries = getWheelData(fixture())?.entries ?? [];
    expect(drawWeightedWinner(entries, () => 0).name).toBe("Avery Moss");
    expect(drawWeightedWinner(entries, () => 0.99).name).toBe("Blair Rowan");
  });
});
