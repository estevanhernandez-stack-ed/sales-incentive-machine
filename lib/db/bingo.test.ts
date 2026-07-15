import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { countCompletedLines, createBingoGrid, recordBingoSubmission, rerollBingoCard } from "./bingo";

const pool = Array.from({ length: 28 }, (_, index) => index + 1);

function fixture() {
  const db = new Database(":memory:");
  db.exec(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
  db.exec("INSERT INTO servers VALUES (1, 'Avery Moss', '#d97706', 1)");
  db.exec(`INSERT INTO contests VALUES (1, 'Signal Sprint', '2026-07-13', '${JSON.stringify({ bingo_pool: pool, entry_rules: { per_goal_met: 1, per_bingo_win: 2 } })}', 'active', 'manual')`);
  db.exec(`INSERT INTO bingo_cards VALUES (1, 1, 1, '${JSON.stringify([...pool.slice(0, 12), "FREE", ...pool.slice(12, 24)])}', '2026-07-13T16:00:00.000Z')`);
  return db;
}

describe("bingo cards", () => {
  it("always creates 25 cells with a free center and 24 unique items", () => {
    const grid = createBingoGrid(pool, () => 0.37);
    const itemIds = grid.filter((cell): cell is number => cell !== "FREE");
    expect(grid).toHaveLength(25);
    expect(grid[12]).toBe("FREE");
    expect(new Set(itemIds)).toHaveLength(24);
  });

  it("counts every completed row, column, and diagonal with the free center", () => {
    expect(countCompletedLines([0, 1, 2, 3, 4])).toBe(1);
    expect(countCompletedLines([0, 6, 18, 24])).toBe(1);
    expect(countCompletedLines([0, 1, 2, 3, 4, 5, 10, 15, 20])).toBe(2);
  });

  it("always logs a daily win but grants wheel entries only before a drawing", () => {
    const db = fixture();
    expect(recordBingoSubmission(db, 1, [0, 1, 2, 3, 4])).toMatchObject({ linesCompleted: 1, dailyWin: true, entriesAwarded: 2 });
    expect(recordBingoSubmission(db, 1, [0, 1, 2, 3, 4])).toMatchObject({ dailyWin: true, entriesAwarded: 0, alreadyLogged: true });
    expect(db.prepare("SELECT COUNT(*) AS count FROM bingo_submissions").get()).toEqual({ count: 1 });
    rerollBingoCard(db, 1);
    const replacement = db.prepare("SELECT MAX(id) AS id FROM bingo_cards").get() as { id: number };
    expect(recordBingoSubmission(db, replacement.id, [0, 1, 2, 3, 4])).toMatchObject({ dailyWin: true, entriesAwarded: 0, alreadyLogged: true });
    expect(db.prepare("SELECT COUNT(*) AS count FROM bingo_submissions").get()).toEqual({ count: 1 });
    db.exec("INSERT INTO wheel_drawings VALUES (1, 1, '2026-07-14T01:00:00.000Z', 1, '[]')");
    expect(recordBingoSubmission(db, replacement.id, [0, 1, 2, 3, 4])).toMatchObject({ linesCompleted: 1, dailyWin: true, entriesAwarded: 0 });
  });
});
