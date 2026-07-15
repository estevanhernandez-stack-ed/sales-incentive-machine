import type Database from "better-sqlite3";

export type BingoCell = number | "FREE";

type BingoConfig = {
  bingo_pool: number[];
  entry_rules: { per_goal_met: number; per_bingo_win: number };
};

type ActiveContestRow = { id: number; name: string; week_start: string; config_json: string };
type CardRow = { id: number; server_id: number; server_name: string; server_color: string; grid_json: string };
type CardRecord = { id: number; contest_id: number; server_id: number; grid_json: string; config_json: string };
type ItemRow = { id: number; name: string };

export type BingoCard = {
  id: number;
  serverId: number;
  serverName: string;
  serverColor: string;
  grid: BingoCell[];
};

export type BingoPageData = {
  contest: { id: number; name: string; weekStart: string };
  cards: BingoCard[];
  itemNames: Record<number, string>;
  dailyWins: Record<number, number>;
};

const winningLines = [
  [0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20, 21, 22, 23, 24],
  [0, 5, 10, 15, 20], [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24],
  [0, 6, 12, 18, 24], [4, 8, 12, 16, 20],
];

function parseConfig(raw: string): BingoConfig {
  const config = JSON.parse(raw) as BingoConfig;
  if (!Array.isArray(config.bingo_pool) || config.bingo_pool.length < 24 || !config.entry_rules) throw new Error("Contest needs at least 24 bingo items");
  if (new Set(config.bingo_pool).size !== config.bingo_pool.length) throw new Error("Contest bingo pool must not contain duplicates");
  return config;
}

function parseGrid(raw: string): BingoCell[] {
  const grid = JSON.parse(raw) as BingoCell[];
  if (grid.length !== 25 || grid[12] !== "FREE") throw new Error("Bingo card has an invalid grid");
  return grid;
}

/** Creates a five-by-five card with 24 distinct menu items and a fixed free center. */
export function createBingoGrid(pool: number[], random = Math.random): BingoCell[] {
  if (pool.length < 24 || new Set(pool).size !== pool.length) throw new Error("Bingo pool requires at least 24 unique menu item IDs");
  const shuffled = [...pool];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  const grid = shuffled.slice(0, 24) as BingoCell[];
  grid.splice(12, 0, "FREE");
  return grid;
}

export function normalizeMarkedCells(markedCells: unknown): number[] {
  if (!Array.isArray(markedCells)) throw new Error("Marked cells must be an array");
  const normalized = new Set(markedCells);
  for (const cell of normalized) {
    if (!Number.isInteger(cell) || cell < 0 || cell > 24) throw new Error("Marked cells must be card indexes");
  }
  normalized.add(12);
  return [...normalized].sort((a, b) => a - b) as number[];
}

/** Counts completed rows, columns, and diagonals; the free center always counts. */
export function countCompletedLines(markedCells: Iterable<number>) {
  const marked = new Set(markedCells);
  marked.add(12);
  return winningLines.filter((line) => line.every((cell) => marked.has(cell))).length;
}

export function getBingoPageData(db: Database.Database): BingoPageData | null {
  const contest = db.prepare("SELECT id, name, week_start, config_json FROM contests WHERE status = 'active' ORDER BY week_start DESC LIMIT 1").get() as ActiveContestRow | undefined;
  if (!contest) return null;
  parseConfig(contest.config_json);
  const cards = db.prepare(`
    SELECT bc.id, bc.server_id, s.name AS server_name, s.color AS server_color, bc.grid_json
    FROM bingo_cards bc JOIN servers s ON s.id = bc.server_id
    WHERE bc.contest_id = ? AND bc.id = (SELECT newer.id FROM bingo_cards newer WHERE newer.contest_id = bc.contest_id AND newer.server_id = bc.server_id ORDER BY newer.created_at DESC, newer.id DESC LIMIT 1) ORDER BY s.name
  `).all(contest.id) as CardRow[];
  const itemNames = Object.fromEntries((db.prepare("SELECT id, name FROM menu_items").all() as ItemRow[]).map((item) => [item.id, item.name]));
  const dailyWins = Object.fromEntries((db.prepare(`
    SELECT bc.server_id, COUNT(*) AS wins FROM bingo_submissions bs
    JOIN bingo_cards bc ON bc.id = bs.card_id
    WHERE bc.contest_id = ? AND bs.lines_completed >= 1 GROUP BY bc.server_id
  `).all(contest.id) as Array<{ server_id: number; wins: number }>).map((row) => [row.server_id, row.wins]));

  return {
    contest: { id: contest.id, name: contest.name, weekStart: contest.week_start },
    cards: cards.map((card) => ({ id: card.id, serverId: card.server_id, serverName: card.server_name, serverColor: card.server_color, grid: parseGrid(card.grid_json) })),
    itemNames,
    dailyWins,
  };
}

/** Replaces one server's card with a freshly randomized arrangement from the active contest pool. */
export function rerollBingoCard(db: Database.Database, serverId: number) {
  const contest = db.prepare("SELECT id, config_json FROM contests WHERE status = 'active' ORDER BY week_start DESC LIMIT 1").get() as Pick<ActiveContestRow, "id" | "config_json"> | undefined;
  if (!contest) throw new Error("No active contest");
  const config = parseConfig(contest.config_json);
  const card = db.prepare("SELECT id, grid_json FROM bingo_cards WHERE contest_id = ? AND server_id = ? ORDER BY created_at DESC, id DESC LIMIT 1").get(contest.id, serverId) as Pick<CardRecord, "id" | "grid_json"> | undefined;
  if (!card) throw new Error("Bingo card not found");
  const existingGrids = new Set((db.prepare("SELECT grid_json FROM bingo_cards WHERE contest_id = ?").all(contest.id) as Array<{ grid_json: string }>).map((row) => row.grid_json));
  let grid = createBingoGrid(config.bingo_pool);
  for (let attempts = 0; existingGrids.has(JSON.stringify(grid)) && attempts < 20; attempts += 1) grid = createBingoGrid(config.bingo_pool);
  if (existingGrids.has(JSON.stringify(grid))) [grid[0], grid[1]] = [grid[1], grid[0]];
  const id = (db.prepare("SELECT COALESCE(MAX(id), 0) + 1 AS id FROM bingo_cards").get() as { id: number }).id;
  db.prepare("INSERT INTO bingo_cards (id, contest_id, server_id, grid_json, created_at) VALUES (?, ?, ?, ?, ?)").run(id, contest.id, serverId, JSON.stringify(grid), new Date().toISOString());
  return grid;
}

/** Creates a complete, distinct card set whenever a fresh contest becomes active. */
export function createBingoCardsForContest(db: Database.Database, contestId: number, pool: number[]) {
  const servers = db.prepare("SELECT id FROM servers WHERE active = 1 ORDER BY id").all() as Array<{ id: number }>;
  let nextId = (db.prepare("SELECT COALESCE(MAX(id), 0) + 1 AS id FROM bingo_cards").get() as { id: number }).id;
  const grids = new Set<string>();
  for (const server of servers) { let grid = createBingoGrid(pool); for (let attempts = 0; grids.has(JSON.stringify(grid)) && attempts < 20; attempts += 1) grid = createBingoGrid(pool); if (grids.has(JSON.stringify(grid))) [grid[0], grid[1]] = [grid[1], grid[0]]; grids.add(JSON.stringify(grid)); db.prepare("INSERT INTO bingo_cards (id, contest_id, server_id, grid_json, created_at) VALUES (?, ?, ?, ?, ?)").run(nextId++, contestId, server.id, JSON.stringify(grid), new Date().toISOString()); }
}

/** Records a completed card and grants wheel entries only while its active contest has no drawing. */
export function recordBingoSubmission(db: Database.Database, cardId: number, markedCells: unknown) {
  const card = db.prepare(`
    SELECT bc.id, bc.contest_id, bc.server_id, bc.grid_json, c.config_json
    FROM bingo_cards bc JOIN contests c ON c.id = bc.contest_id
    WHERE bc.id = ? AND c.status = 'active'
  `).get(cardId) as CardRecord | undefined;
  if (!card) throw new Error("Bingo card is not part of the active contest");
  const newestCard = db.prepare("SELECT id FROM bingo_cards WHERE contest_id = ? AND server_id = (SELECT server_id FROM bingo_cards WHERE id = ?) ORDER BY created_at DESC, id DESC LIMIT 1").get(card.contest_id, card.id) as { id: number } | undefined;
  if (newestCard?.id !== card.id) throw new Error("This card has been re-randomized; use the current card");
  parseGrid(card.grid_json);
  const config = parseConfig(card.config_json);
  const cells = normalizeMarkedCells(markedCells);
  const linesCompleted = countCompletedLines(cells);
  const write = db.transaction(() => {
    if (linesCompleted >= 1) { const existing = db.prepare(`SELECT bs.id, bs.lines_completed, bs.entries_awarded FROM bingo_submissions bs JOIN bingo_cards bc ON bc.id = bs.card_id WHERE bc.contest_id = ? AND bc.server_id = ? AND bs.lines_completed >= 1 AND date(bs.submitted_at) = date('now') ORDER BY bs.id LIMIT 1`).get(card.contest_id, card.server_id) as { id: number; lines_completed: number; entries_awarded: number } | undefined; if (existing) return { submissionId: existing.id, linesCompleted: existing.lines_completed, dailyWin: true, entriesAwarded: 0, alreadyLogged: true }; }
    const drawingOpen = !db.prepare("SELECT 1 FROM wheel_drawings WHERE contest_id = ?").get(card.contest_id);
    const entriesAwarded = linesCompleted >= 1 && drawingOpen ? config.entry_rules.per_bingo_win : 0;
    const result = db.prepare("INSERT INTO bingo_submissions (card_id, submitted_at, marked_cells_json, lines_completed, entries_awarded) VALUES (?, ?, ?, ?, ?)").run(card.id, new Date().toISOString(), JSON.stringify(cells), linesCompleted, entriesAwarded); return { submissionId: Number(result.lastInsertRowid), linesCompleted, dailyWin: linesCompleted >= 1, entriesAwarded, alreadyLogged: false };
  });
  return write();
}
