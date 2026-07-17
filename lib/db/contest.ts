import type Database from "better-sqlite3";
import type { ContestConfig } from "../contest-designer";
import { createBingoCardsForContest } from "./bingo";

export type ContestMenuItem = { id: number; name: string; category: string };
export type ContestSetupData = { id: number; name: string; config: ContestConfig; menuItems: ContestMenuItem[] };

export function getContestSetupData(db: Database.Database): ContestSetupData | null {
  const contest = db.prepare("SELECT id, name, config_json FROM contests WHERE status = 'active' ORDER BY week_start DESC LIMIT 1").get() as { id: number; name: string; config_json: string } | undefined;
  if (!contest) return null;
  const menuItems = db.prepare("SELECT id, name, category FROM menu_items ORDER BY category, name").all() as ContestMenuItem[];
  return { id: contest.id, name: contest.name, config: JSON.parse(contest.config_json) as ContestConfig, menuItems };
}

/** Closes the current contest and creates the complete active replacement in one transaction. */
export function activateContest(db: Database.Database, input: { name: string; config: ContestConfig; createdVia?: "manual" | "ai" }) {
  if (!input.name.trim()) throw new Error("Contest name is required");
  return db.transaction(() => {
    const active = db.prepare("SELECT id FROM contests WHERE status = 'active' ORDER BY week_start DESC LIMIT 1").get() as { id: number } | undefined;
    if (!active) throw new Error("No active contest");
    const nextId = (db.prepare("SELECT COALESCE(MAX(id), 0) + 1 AS id FROM contests").get() as { id: number }).id;
    db.prepare("UPDATE contests SET status = 'closed' WHERE id = ?").run(active.id);
    db.prepare("INSERT INTO contests (id, name, week_start, config_json, status, created_via) VALUES (?, ?, ?, ?, 'active', ?)").run(nextId, input.name.trim(), new Date().toISOString().slice(0, 10), JSON.stringify(input.config), input.createdVia ?? "manual");
    createBingoCardsForContest(db, nextId, input.config.bingo_pool);
    const cardCount = (db.prepare("SELECT COUNT(*) AS count FROM bingo_cards WHERE contest_id = ?").get(nextId) as { count: number }).count;
    return { contestId: nextId, previousContestId: active.id, cardCount };
  })();
}
