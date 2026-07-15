import type Database from "better-sqlite3";
import type { ContestConfig } from "../contest-designer";

export type ContestMenuItem = { id: number; name: string; category: string };
export type ContestSetupData = { name: string; config: ContestConfig; menuItems: ContestMenuItem[] };

export function getContestSetupData(db: Database.Database): ContestSetupData | null {
  const contest = db.prepare("SELECT name, config_json FROM contests WHERE status = 'active' ORDER BY week_start DESC LIMIT 1").get() as { name: string; config_json: string } | undefined;
  if (!contest) return null;
  const menuItems = db.prepare("SELECT id, name, category FROM menu_items ORDER BY category, name").all() as ContestMenuItem[];
  return { name: contest.name, config: JSON.parse(contest.config_json) as ContestConfig, menuItems };
}
