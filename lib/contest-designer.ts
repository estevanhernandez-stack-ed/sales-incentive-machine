import { readFileSync } from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import { getMetric, type Metric } from "./db/metrics";

const categories = ["app", "entree", "dessert", "cocktail", "top_shelf", "na_bev"] as const;
const metrics = ["ppa", "avg_check", "alcohol_pct", "attach_rate", "item_count", "large_party_ppa"] as const;
export type ContestCategory = typeof categories[number];
export type ContestGoalConfig = { metric: Metric; category?: ContestCategory; menu_item_id?: number; threshold?: number; vs_house?: true };
export type SalesRaceConfig = { id: string; type: "sales_race"; title: string; metric: ContestGoalConfig; entries_by_place: number[] };
export type MenuMissionConfig = { id: string; type: "menu_mission"; title: string; objectives: ContestGoalConfig[]; entries_on_completion: number };
export type ContestGameConfig = SalesRaceConfig | MenuMissionConfig;
export type ContestConfig = { goals: ContestGoalConfig[]; bingo_pool: number[]; entry_rules: { per_goal_met: number; per_bingo_win: number }; games?: ContestGameConfig[]; prize: string };

export function fallbackContest(): ContestConfig {
  return JSON.parse(readFileSync(path.join(process.cwd(), "seed", "fallback-contest.json"), "utf8")) as ContestConfig;
}

function normalizeGoal(goal: ContestGoalConfig, menuItemIds: Set<number>, targetRequired = true): ContestGoalConfig {
    const hasThreshold = typeof goal.threshold === "number" && Number.isFinite(goal.threshold);
    const vsHouse = goal.vs_house === true;
    const menuItemId = typeof goal.menu_item_id === "number" ? goal.menu_item_id : undefined;
    if (!metrics.includes(goal.metric) || (targetRequired ? hasThreshold === vsHouse : hasThreshold && vsHouse)) throw new Error("Every goal needs one valid target");
    if (hasThreshold && goal.threshold! < 0) throw new Error("Goal thresholds cannot be negative");
    if (hasThreshold && (goal.metric === "alcohol_pct" || goal.metric === "attach_rate") && goal.threshold! > 1) throw new Error("Rate thresholds must be between 0 and 1");
    if (goal.category && (!categories.includes(goal.category) || goal.metric !== "attach_rate")) throw new Error("Categories are only valid for attachment goals");
    if (goal.menu_item_id != null && (menuItemId === undefined || !Number.isInteger(menuItemId) || !menuItemIds.has(menuItemId) || (goal.metric !== "attach_rate" && goal.metric !== "item_count"))) throw new Error("Goal references an invalid menu item");
    if (goal.category && menuItemId !== undefined) throw new Error("Attachment goals must target either a category or an item");
    if (goal.metric === "attach_rate" && !goal.category && menuItemId === undefined) throw new Error("Attachment goals need a category or menu item");
    if (goal.metric === "item_count" && menuItemId === undefined) throw new Error("Item count goals need a menu item");
    return { metric: goal.metric, ...(goal.category ? { category: goal.category } : {}), ...(menuItemId !== undefined ? { menu_item_id: menuItemId } : {}), ...(hasThreshold ? { threshold: goal.threshold } : vsHouse ? { vs_house: true as const } : {}) };
}

export function validateContestConfig(config: unknown, menuItemIds: Set<number>): ContestConfig {
  const candidate = config as ContestConfig;
  if (!candidate || !Array.isArray(candidate.goals) || !Array.isArray(candidate.bingo_pool) || !candidate.entry_rules || typeof candidate.prize !== "string" || !candidate.prize.trim()) throw new Error("Contest config is incomplete");
  if (!candidate.goals.length) throw new Error("Contest needs at least one goal");
  const goals = candidate.goals.map((goal) => normalizeGoal(goal, menuItemIds));
  if (candidate.bingo_pool.length < 24 || new Set(candidate.bingo_pool).size !== candidate.bingo_pool.length || candidate.bingo_pool.some((id) => !menuItemIds.has(id))) throw new Error("Bingo pool needs at least 24 distinct menu items");
  if (!Number.isInteger(candidate.entry_rules.per_goal_met) || candidate.entry_rules.per_goal_met < 0 || !Number.isInteger(candidate.entry_rules.per_bingo_win) || candidate.entry_rules.per_bingo_win < 0) throw new Error("Entry rules must be non-negative whole numbers");
  const rawGames = candidate.games ?? [];
  if (!Array.isArray(rawGames) || new Set(rawGames.map((game) => game.id)).size !== rawGames.length) throw new Error("Sales games need unique IDs");
  const games = rawGames.map((game): ContestGameConfig => {
    if (!game.id?.trim() || !game.title?.trim()) throw new Error("Every sales game needs a name");
    if (game.type === "sales_race") {
      if (!Array.isArray(game.entries_by_place) || !game.entries_by_place.length || game.entries_by_place.some((entry) => !Number.isInteger(entry) || entry < 0)) throw new Error("Race awards must be non-negative whole numbers");
      const metric = normalizeGoal(game.metric, menuItemIds, false);
      return { id: game.id, type: "sales_race", title: game.title.trim(), metric, entries_by_place: game.entries_by_place };
    }
    if (game.type === "menu_mission") {
      if (!Array.isArray(game.objectives) || !game.objectives.length || !Number.isInteger(game.entries_on_completion) || game.entries_on_completion < 0) throw new Error("Goal board scoring is invalid");
      return { id: game.id, type: "menu_mission", title: game.title.trim(), objectives: game.objectives.map((goal) => normalizeGoal(goal, menuItemIds)), entries_on_completion: game.entries_on_completion };
    }
    throw new Error("Unknown sales game type");
  });
  return { goals, bingo_pool: [...candidate.bingo_pool], entry_rules: { ...candidate.entry_rules }, ...(games.length ? { games } : {}), prize: candidate.prize.trim() };
}

export function getDesignerContext(db: Database.Database) {
  const menu = db.prepare("SELECT id, name, category, price, is_alcohol FROM menu_items ORDER BY category, name").all() as Array<{ id: number; name: string; category: string; price: number; is_alcohol: number }>;
  const serverStats = (db.prepare("SELECT id, name FROM servers WHERE active = 1 ORDER BY name").all() as Array<{ id: number; name: string }>).map((server) => ({
    name: server.name,
    ppa: Number(getMetric(db, { metric: "ppa" }, server.id).toFixed(2)),
    avg_check: Number(getMetric(db, { metric: "avg_check" }, server.id).toFixed(2)),
    alcohol_pct: Number(getMetric(db, { metric: "alcohol_pct" }, server.id).toFixed(3)),
    appetizer_attach: Number(getMetric(db, { metric: "attach_rate", category: "app" }, server.id).toFixed(3)),
    dessert_attach: Number(getMetric(db, { metric: "attach_rate", category: "dessert" }, server.id).toFixed(3)),
  }));
  const houseStats = {
    ppa: Number(getMetric(db, { metric: "ppa" }).toFixed(2)),
    avg_check: Number(getMetric(db, { metric: "avg_check" }).toFixed(2)),
    alcohol_pct: Number(getMetric(db, { metric: "alcohol_pct" }).toFixed(3)),
    appetizer_attach: Number(getMetric(db, { metric: "attach_rate", category: "app" }).toFixed(3)),
    dessert_attach: Number(getMetric(db, { metric: "attach_rate", category: "dessert" }).toFixed(3)),
  };
  const itemSales = menu.map((item) => ({ id: item.id, name: item.name, qty: getMetric(db, { metric: "item_count", menuItemId: item.id }) }));
  return { menu, serverStats, houseStats, itemSales };
}

export const contestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["goals", "bingo_pool", "entry_rules", "prize"],
  properties: {
    goals: {
      type: "array", minItems: 1,
      items: {
        type: "object", additionalProperties: false, required: ["metric", "category", "menu_item_id", "threshold", "vs_house"],
        properties: {
          metric: { type: "string", enum: metrics },
          category: { anyOf: [{ type: "string", enum: categories }, { type: "null" }] },
          menu_item_id: { anyOf: [{ type: "integer" }, { type: "null" }] },
          threshold: { anyOf: [{ type: "number", minimum: 0 }, { type: "null" }] },
          vs_house: { anyOf: [{ type: "boolean" }, { type: "null" }] },
        },
      },
    },
    bingo_pool: { type: "array", minItems: 24, items: { type: "integer" } },
    entry_rules: {
      type: "object", additionalProperties: false, required: ["per_goal_met", "per_bingo_win"],
      properties: { per_goal_met: { type: "integer", minimum: 0 }, per_bingo_win: { type: "integer", minimum: 0 } },
    },
    prize: { type: "string" },
  },
};
