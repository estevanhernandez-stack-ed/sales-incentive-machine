import type Database from "better-sqlite3";
import { goalMetricDefinition, qualifiesForGoal, type ContestGoal } from "./dashboard";
import { getHouseMetric, getMetric } from "./metrics";

type SalesRace = { id: string; type: "sales_race"; title: string; metric: ContestGoal; entries_by_place: number[] };
type MenuMission = { id: string; type: "menu_mission"; title: string; objectives: ContestGoal[]; entries_on_completion: number };
type Game = SalesRace | MenuMission;
type ContestRow = { id: number; config_json: string };
type Server = { id: number; name: string; color: string };

function metricLabel(goal: ContestGoal, menuItems: Map<number, string>) {
  if (goal.metric === "ppa") return "PPA";
  if (goal.metric === "avg_check") return "Average check";
  if (goal.metric === "alcohol_pct") return "Alcohol sales";
  if (goal.metric === "large_party_ppa") return "Large-party PPA";
  if (goal.metric === "item_count") return `${menuItems.get(goal.menu_item_id ?? 0) ?? "Menu item"} sold`;
  return goal.category ? `${goal.category.replace("_", " ")} attachment` : `${menuItems.get(goal.menu_item_id ?? 0) ?? "Menu item"} attachment`;
}

function activeContest(db: Database.Database) { return db.prepare("SELECT id, config_json FROM contests WHERE status = 'active' ORDER BY week_start DESC LIMIT 1").get() as ContestRow | undefined; }
function parseGames(raw: string): Game[] { const config = JSON.parse(raw) as { games?: Game[] }; const games = config.games ?? []; if (new Set(games.map((game) => game.id)).size !== games.length) throw new Error("Game IDs must be unique"); return games; }
function gameAwards(db: Database.Database, contestId: number, gameId: string) { return db.prepare("SELECT server_id, entries_awarded FROM game_awards WHERE contest_id = ? AND game_id = ? ORDER BY place").all(contestId, gameId) as Array<{ server_id: number; entries_awarded: number }>; }

export function getGamesData(db: Database.Database) {
  const contest = activeContest(db); if (!contest) return null;
  const servers = db.prepare("SELECT id, name, color FROM servers WHERE active = 1 ORDER BY id").all() as Server[];
  const menuItems = new Map((db.prepare("SELECT id, name FROM menu_items").all() as Array<{ id: number; name: string }>).map((item) => [item.id, item.name]));
  const games = parseGames(contest.config_json).map((game) => {
    const awards = gameAwards(db, contest.id, game.id);
    if (game.type === "sales_race") { const standings = servers.map((server) => ({ ...server, value: getMetric(db, goalMetricDefinition(game.metric), server.id) })).sort((a, b) => b.value - a.value || a.id - b.id); return { ...game, metricLabel: metricLabel(game.metric, menuItems), awards, standings }; }
    const house = game.objectives.map((objective) => getHouseMetric(db, goalMetricDefinition(objective)));
    const standings = servers.map((server) => ({ ...server, objectives: game.objectives.map((objective, index) => { const value = getMetric(db, goalMetricDefinition(objective), server.id); return { label: metricLabel(objective, menuItems), metric: objective.metric, value, complete: qualifiesForGoal(value, house[index], objective) }; }) }));
    return { ...game, objectiveLabels: game.objectives.map((objective) => metricLabel(objective, menuItems)), awards, standings };
  });
  return { contestId: contest.id, games };
}

export function lockSalesRace(db: Database.Database, gameId: string) { return db.transaction(() => { const contest = activeContest(db); if (!contest) throw new Error("No active contest"); if (db.prepare("SELECT 1 FROM wheel_drawings WHERE contest_id = ?").get(contest.id)) throw new Error("The drawing is already closed"); const game = parseGames(contest.config_json).find((entry): entry is SalesRace => entry.id === gameId && entry.type === "sales_race"); if (!game) throw new Error("Sales Race not found"); if (gameAwards(db, contest.id, game.id).length) throw new Error("This race is already locked"); const servers = db.prepare("SELECT id FROM servers WHERE active = 1 ORDER BY id").all() as Array<{ id: number }>; const results = servers.map((server) => ({ serverId: server.id, value: getMetric(db, goalMetricDefinition(game.metric), server.id) })).filter((entry) => entry.value > 0).sort((a, b) => b.value - a.value || a.serverId - b.serverId); const award = db.prepare("INSERT INTO game_awards (contest_id, game_id, server_id, award_type, place, entries_awarded, awarded_at) VALUES (?, ?, ?, 'sales_race', ?, ?, ?)"); results.slice(0, game.entries_by_place.length).forEach((entry, index) => award.run(contest.id, game.id, entry.serverId, index + 1, game.entries_by_place[index], new Date().toISOString())); return results.slice(0, game.entries_by_place.length); })(); }

export function awardMenuMission(db: Database.Database, gameId: string) { return db.transaction(() => { const contest = activeContest(db); if (!contest) throw new Error("No active contest"); if (db.prepare("SELECT 1 FROM wheel_drawings WHERE contest_id = ?").get(contest.id)) throw new Error("The drawing is already closed"); const game = parseGames(contest.config_json).find((entry): entry is MenuMission => entry.id === gameId && entry.type === "menu_mission"); if (!game) throw new Error("Menu Mission not found"); const house = game.objectives.map((objective) => getHouseMetric(db, goalMetricDefinition(objective))); const existing = new Set(gameAwards(db, contest.id, game.id).map((award) => award.server_id)); const servers = db.prepare("SELECT id FROM servers WHERE active = 1 ORDER BY id").all() as Array<{ id: number }>; const eligible = servers.filter((server) => !existing.has(server.id) && game.objectives.every((objective, index) => qualifiesForGoal(getMetric(db, goalMetricDefinition(objective), server.id), house[index], objective))); const award = db.prepare("INSERT INTO game_awards (contest_id, game_id, server_id, award_type, entries_awarded, awarded_at) VALUES (?, ?, ?, 'menu_mission', ?, ?)"); eligible.forEach((server) => award.run(contest.id, game.id, server.id, game.entries_on_completion, new Date().toISOString())); return eligible.map((server) => server.id); })(); }
