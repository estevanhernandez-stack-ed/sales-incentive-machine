import type Database from "better-sqlite3";
import { goalMetricDefinition, qualifiesForGoal, type ContestGoal } from "./dashboard";
import { getHouseMetric, getMetric } from "./metrics";

type WheelConfig = {
  goals: ContestGoal[];
  entry_rules: { per_goal_met: number; per_bingo_win: number };
  prize: string;
};

type ContestRow = { id: number; name: string; config_json: string };
type ServerRow = { id: number; name: string; color: string };
type DrawingRow = { id: number; contest_id: number; contest_name: string; drawn_at: string; winner_server_id: number; winner_name: string; entries_snapshot_json: string };

export type WheelEntry = {
  serverId: number;
  name: string;
  color: string;
  goalsMet: number;
  dailyWins: number;
  entries: number;
  entryBreakdown: { goals: number; bingo: number; games: number };
  performance: { ppa: number; avgCheck: number; alcoholPct: number; appetizerAttach: number; dessertAttach: number };
  goalStats: Array<{ label: string; value: number; target: string; qualified: boolean; metric: ContestGoal["metric"] }>;
};
export type WheelData = {
  contest: { id: number; name: string; prize: string };
  entries: WheelEntry[];
  currentDrawing: { id: number; winnerName: string; drawnAt: string } | null;
  history: Array<{ id: number; contestName: string; winnerName: string; drawnAt: string }>;
};

function parseConfig(raw: string): WheelConfig {
  const config = JSON.parse(raw) as WheelConfig;
  if (!Array.isArray(config.goals) || !config.entry_rules || typeof config.prize !== "string") throw new Error("Active contest has an invalid config");
  return config;
}

function currentContest(db: Database.Database) {
  return db.prepare("SELECT id, name, config_json FROM contests WHERE status = 'active' ORDER BY week_start DESC LIMIT 1").get() as ContestRow | undefined;
}

function goalLabel(goal: ContestGoal, menuItems: Map<number, string>) {
  if (goal.metric === "ppa") return "Per-person average";
  if (goal.metric === "avg_check") return "Average check";
  if (goal.metric === "alcohol_pct") return "Alcohol sales";
  if (goal.metric === "large_party_ppa") return "Large-party PPA";
  if (goal.metric === "item_count") return `${menuItems.get(goal.menu_item_id ?? 0) ?? "Menu item"} sold`;
  return goal.category ? `${goal.category.replace("_", " ")} attachment` : `${menuItems.get(goal.menu_item_id ?? 0) ?? "Menu item"} attachment`;
}

function goalTarget(goal: ContestGoal) {
  if (goal.vs_house) return "Beat house";
  if (goal.threshold === undefined) return "Qualify";
  if (goal.metric === "alcohol_pct" || goal.metric === "attach_rate") return `${(goal.threshold * 100).toFixed(0)}%`;
  if (goal.metric === "item_count") return `${goal.threshold} sold`;
  return `$${goal.threshold.toFixed(2)}`;
}

function getEntrySnapshot(db: Database.Database, contest: ContestRow, config: WheelConfig): WheelEntry[] {
  const bingoEntries = new Map((db.prepare(`
    SELECT bc.server_id, COALESCE(SUM(bs.entries_awarded), 0) AS entries, COUNT(CASE WHEN bs.lines_completed >= 1 THEN 1 END) AS daily_wins
    FROM bingo_cards bc LEFT JOIN bingo_submissions bs ON bs.card_id = bc.id
    WHERE bc.contest_id = ? GROUP BY bc.server_id
  `).all(contest.id) as Array<{ server_id: number; entries: number; daily_wins: number }>).map((row) => [row.server_id, row]));
  const servers = db.prepare("SELECT id, name, color FROM servers WHERE active = 1 ORDER BY name").all() as ServerRow[];
  const menuItems = new Map((db.prepare("SELECT id, name FROM menu_items").all() as Array<{ id: number; name: string }>).map((item) => [item.id, item.name]));
  const gameEntries = new Map((db.prepare("SELECT server_id, COALESCE(SUM(entries_awarded), 0) AS entries FROM game_awards WHERE contest_id = ? GROUP BY server_id").all(contest.id) as Array<{ server_id: number; entries: number }>).map((row) => [row.server_id, row.entries]));
  const houseValues = config.goals.map((goal) => getHouseMetric(db, goalMetricDefinition(goal)));
  return servers.map((server) => {
    const goalStats = config.goals.map((goal, index) => {
      const value = getMetric(db, goalMetricDefinition(goal), server.id);
      return { label: goalLabel(goal, menuItems), value, target: goalTarget(goal), qualified: qualifiesForGoal(value, houseValues[index], goal), metric: goal.metric };
    });
    const goalsMet = goalStats.filter((goal) => goal.qualified).length;
    const bingo = bingoEntries.get(server.id);
    const goalEntries = goalsMet * config.entry_rules.per_goal_met;
    const bingoAwarded = bingo?.entries ?? 0;
    const gamesAwarded = gameEntries.get(server.id) ?? 0;
    return {
      serverId: server.id,
      name: server.name,
      color: server.color,
      goalsMet,
      dailyWins: bingo?.daily_wins ?? 0,
      entries: goalEntries + bingoAwarded + gamesAwarded,
      entryBreakdown: { goals: goalEntries, bingo: bingoAwarded, games: gamesAwarded },
      performance: {
        ppa: getMetric(db, { metric: "ppa" }, server.id),
        avgCheck: getMetric(db, { metric: "avg_check" }, server.id),
        alcoholPct: getMetric(db, { metric: "alcohol_pct" }, server.id),
        appetizerAttach: getMetric(db, { metric: "attach_rate", category: "app" }, server.id),
        dessertAttach: getMetric(db, { metric: "attach_rate", category: "dessert" }, server.id),
      },
      goalStats,
    };
  });
}

/** Builds wheel entries from live goal qualifications plus entries awarded by qualifying bingo wins. */
export function getWheelData(db: Database.Database): WheelData | null {
  const contest = currentContest(db);
  if (!contest) return null;
  const config = parseConfig(contest.config_json);
  const drawings = db.prepare(`
    SELECT wd.id, wd.contest_id, c.name AS contest_name, wd.drawn_at, wd.winner_server_id, s.name AS winner_name, wd.entries_snapshot_json
    FROM wheel_drawings wd JOIN contests c ON c.id = wd.contest_id JOIN servers s ON s.id = wd.winner_server_id
    ORDER BY wd.drawn_at DESC
  `).all() as DrawingRow[];
  const current = drawings.find((drawing) => drawing.contest_id === contest.id) ?? null;
  let entries = getEntrySnapshot(db, contest, config);
  if (current) {
    const snapshot = JSON.parse(current.entries_snapshot_json) as Array<{ serverId: number; entries: number }>;
    const storedEntries = new Map(snapshot.map((entry) => [entry.serverId, entry.entries]));
    entries = entries.map((entry) => ({ ...entry, entries: storedEntries.get(entry.serverId) ?? 0 }));
  }
  return {
    contest: { id: contest.id, name: contest.name, prize: config.prize },
    entries,
    currentDrawing: current ? { id: current.id, winnerName: current.winner_name, drawnAt: current.drawn_at } : null,
    history: drawings.map((drawing) => ({ id: drawing.id, contestName: drawing.contest_name, winnerName: drawing.winner_name, drawnAt: drawing.drawn_at })),
  };
}

/** Picks an entry with probability proportional to its entry count. */
export function drawWeightedWinner(entries: WheelEntry[], random = Math.random): WheelEntry {
  const total = entries.reduce((sum, entry) => sum + entry.entries, 0);
  if (total <= 0) throw new Error("At least one qualifying entry is required to spin the wheel");
  let point = random() * total;
  for (const entry of entries) {
    point -= entry.entries;
    if (point < 0) return entry;
  }
  return entries.at(-1) as WheelEntry;
}

export function drawWheel(db: Database.Database) {
  return db.transaction(() => { const data = getWheelData(db); if (!data) throw new Error("No active contest"); if (data.currentDrawing) throw new Error("This contest has already been drawn"); const winner = drawWeightedWinner(data.entries); const snapshot = data.entries.map(({ serverId, entries }) => ({ serverId, entries })); try { const result = db.prepare("INSERT INTO wheel_drawings (contest_id, drawn_at, winner_server_id, entries_snapshot_json) VALUES (?, ?, ?, ?)").run(data.contest.id, new Date().toISOString(), winner.serverId, JSON.stringify(snapshot)); return { drawingId: Number(result.lastInsertRowid), winner, snapshot }; } catch { throw new Error("This contest has already been drawn"); } })();
}
