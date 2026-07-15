import type Database from "better-sqlite3";
import { getHouseMetric, getMetric, type Metric, type MetricDefinition } from "./metrics";

export type ContestGoal = {
  metric: Metric;
  category?: "app" | "entree" | "dessert" | "cocktail" | "top_shelf" | "na_bev";
  menu_item_id?: number;
  threshold?: number;
  vs_house?: boolean;
};

export function goalMetricDefinition(goal: ContestGoal): MetricDefinition { return { metric: goal.metric, category: goal.category, menuItemId: goal.menu_item_id }; }

type ContestConfig = {
  goals: ContestGoal[];
  bingo_pool: number[];
  entry_rules: { per_goal_met: number; per_bingo_win: number };
  prize: string;
  games?: Array<{ type: "sales_race"; metric: ContestGoal } | { type: "menu_mission"; objectives: ContestGoal[] }>;
};

export type DashboardMetric = {
  id: string;
  label: string;
  definition: MetricDefinition;
};

export type DashboardData = {
  contest: {
    id: number;
    name: string;
    weekStart: string;
    prize: string;
    goals: ContestGoal[];
  };
  metrics: DashboardMetric[];
  leaderboard: Array<{
    id: number;
    name: string;
    color: string;
    values: Record<string, number>;
    qualifications: boolean[];
    dailyWins: number;
    edited: boolean;
  }>;
  houseValues: Record<string, number>;
  lastWinner: { name: string; drawnAt: string } | null;
};

type ActiveContestRow = { id: number; name: string; week_start: string; config_json: string };
type ServerRow = { id: number; name: string; color: string };
type MenuItemRow = { id: number; name: string };
type DailyWinRow = { server_id: number; wins: number };
type EditedServerRow = { server_id: number };
type WinnerRow = { name: string; drawn_at: string };

function metricKey(definition: MetricDefinition) {
  return [definition.metric, definition.category ?? "", definition.menuItemId ?? ""].join(":");
}

function metricLabel(definition: MetricDefinition, menuItems: Map<number, string>) {
  switch (definition.metric) {
    case "ppa": return "PPA";
    case "avg_check": return "Average check";
    case "alcohol_pct": return "Alcohol sales %";
    case "large_party_ppa": return "Large-party PPA";
    case "attach_rate": return definition.menuItemId ? `${menuItems.get(definition.menuItemId) ?? "Item"} attachment` : `${definition.category ?? "Item"} attachment`;
    case "item_count": return `${menuItems.get(definition.menuItemId ?? 0) ?? "Item"} sold`;
  }
}

export function qualifiesForGoal(value: number, houseValue: number, goal: ContestGoal) {
  return goal.vs_house ? value > houseValue : value >= (goal.threshold ?? Number.POSITIVE_INFINITY);
}

function parseConfig(raw: string): ContestConfig {
  const config = JSON.parse(raw) as ContestConfig;
  if (!Array.isArray(config.goals) || !Array.isArray(config.bingo_pool) || typeof config.prize !== "string") {
    throw new Error("Active contest has an invalid config");
  }
  return config;
}

/** Returns all live dashboard data; metrics are computed from checks plus scoped contest tally events. */
export function getDashboardData(db: Database.Database): DashboardData | null {
  const activeContest = db.prepare("SELECT id, name, week_start, config_json FROM contests WHERE status = 'active' ORDER BY week_start DESC LIMIT 1").get() as ActiveContestRow | undefined;
  if (!activeContest) return null;

  const config = parseConfig(activeContest.config_json);
  const menuRows = db.prepare("SELECT id, name FROM menu_items").all() as MenuItemRow[];
  const menuItems = new Map(menuRows.map((item) => [item.id, item.name]));
  const baseMetrics: MetricDefinition[] = [
    { metric: "ppa" },
    { metric: "avg_check" },
    { metric: "alcohol_pct" },
    { metric: "attach_rate", category: "app" },
    { metric: "attach_rate", category: "dessert" },
    ...config.bingo_pool.slice(0, 2).map((menuItemId) => ({ metric: "item_count" as const, menuItemId })),
  ];
  const gameMetrics = (config.games ?? []).flatMap((game) => game.type === "sales_race" ? [goalMetricDefinition(game.metric)] : game.objectives.map(goalMetricDefinition));
  const definitions = [...baseMetrics, ...config.goals.map(goalMetricDefinition), ...gameMetrics]
    .filter((definition, index, all) => all.findIndex((other) => metricKey(other) === metricKey(definition)) === index);
  const metrics = definitions.map((definition) => ({ id: metricKey(definition), label: metricLabel(definition, menuItems), definition }));
  const houseValues = Object.fromEntries(metrics.map(({ id, definition }) => [id, getHouseMetric(db, definition, activeContest.id)]));
  const dailyWins = new Map((db.prepare(`
    SELECT bc.server_id, COUNT(*) AS wins
    FROM bingo_submissions bs
    JOIN bingo_cards bc ON bc.id = bs.card_id
    WHERE bc.contest_id = ? AND bs.lines_completed >= 1
    GROUP BY bc.server_id
  `).all(activeContest.id) as DailyWinRow[]).map((row) => [row.server_id, row.wins]));
  const servers = db.prepare("SELECT id, name, color FROM servers WHERE active = 1 ORDER BY name").all() as ServerRow[];
  const editedServerIds = new Set((db.prepare(`
    SELECT DISTINCT c.server_id FROM sales_entry_audit sea JOIN checks c ON c.id = sea.check_id
    WHERE sea.source_type IN ('manual', 'corrected')
  `).all() as EditedServerRow[]).map((row) => row.server_id));
  const lastWinner = db.prepare(`
    SELECT s.name, wd.drawn_at
    FROM wheel_drawings wd JOIN servers s ON s.id = wd.winner_server_id
    ORDER BY wd.drawn_at DESC LIMIT 1
  `).get() as WinnerRow | undefined;

  return {
    contest: { id: activeContest.id, name: activeContest.name, weekStart: activeContest.week_start, prize: config.prize, goals: config.goals },
    metrics,
    houseValues,
    lastWinner: lastWinner ? { name: lastWinner.name, drawnAt: lastWinner.drawn_at } : null,
    leaderboard: servers.map((server) => {
      const values = Object.fromEntries(metrics.map(({ id, definition }) => [id, getMetric(db, definition, server.id, activeContest.id)]));
      const qualifications = config.goals.map((goal) => {
        const id = metricKey(goalMetricDefinition(goal));
        return qualifiesForGoal(values[id], houseValues[id], goal);
      });
      return { ...server, values, qualifications, dailyWins: dailyWins.get(server.id) ?? 0, edited: editedServerIds.has(server.id) };
    }),
  };
}
