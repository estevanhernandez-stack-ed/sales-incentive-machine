# TableStakes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **For this project specifically:** the executor is Este driving **OpenAI Codex** — one task = one evening Codex session = one ticket on the Build Week HQ page. Paste the HQ ticket prompt to start the session; when Codex needs deeper contracts (signatures, schemas, test values), point it at the matching task section in this file. The spec (`docs/superpowers/specs/2026-07-13-tablestakes-design.md`) is the source of truth; this plan is its execution ordering.

**Goal:** Ship TableStakes — restaurant sales-contest platform (leaderboard, Server Bingo, prize wheel, GPT-5.6 Contest Designer) — submittable to OpenAI Build Week by Tue July 21, 5 PM PT.

**Architecture:** Local-first Next.js App Router app over a single SQLite file. All metrics computed in SQL at read time. Contest config is a JSON document on the `contests` row; bingo and wheel derive everything from it. One API route touches the network (Contest Designer) and degrades to a canned config without a key.

**Tech Stack:** Next.js (App Router) + TypeScript + Tailwind, better-sqlite3, Vitest, openai (npm) for the one API route.

## Global Constraints

- `npm install && npm run seed && npm run dev` must work on a fresh clone with zero env vars — always, after every task.
- `OPENAI_API_KEY` is optional. Missing key → `seed/fallback-contest.json`, never an error.
- No secrets in the repo; `.env.local` only (already gitignored).
- Fake data only: no real restaurant, brand, or person names.
- Non-goals (do not build): auth, multi-restaurant, POS integration, deployment, notifications, mobile.
- Contest config JSON keys are snake_case exactly as the spec shows them.
- Conventional commits. Commit at every task's commit step, not less often.
- End every Codex session with `/feedback`; paste the session ID into `SUBMISSION.md`.

## File structure (locked)

```
tablestakes/
├── package.json                     — scripts: dev, build, seed, test
├── .env.example                     — OPENAI_API_KEY=, OPENAI_MODEL=gpt-5.6 (comments: optional)
├── seed/fallback-contest.json       — canned ContestConfig (Task 2)
├── scripts/seed.ts                  — deterministic universe generator (Task 2)
├── lib/
│   ├── types.ts                     — MenuCategory, ContestGoal, ContestConfig, shared row types
│   ├── rng.ts                       — mulberry32 seeded RNG
│   └── db/
│       ├── schema.sql               — the 8 tables, verbatim below
│       ├── client.ts                — getDb(path?) singleton + initSchema(db)
│       ├── metrics.ts               — the 7 metric queries + goalQualifiers + houseValue
│       ├── contests.ts              — activeContest(), createContest(), activateContest()
│       ├── bingo.ts                 — generateCard, completedLines, cards/submissions CRUD, dailyWins
│       └── wheel.ts                 — isDrawingActive, wheelEntries, recordDrawing, drawings
├── app/
│   ├── layout.tsx, globals.css      — nav shell (Dashboard · Contest · Bingo · Wheel)
│   ├── page.tsx                     — Dashboard (Task 3)
│   ├── contest/page.tsx             — Contest Designer + config form (Task 6)
│   ├── bingo/page.tsx               — cards + submissions (Task 4)
│   ├── bingo/print/[cardId]/page.tsx— print view (Task 4)
│   ├── wheel/page.tsx               — TV mode (Task 5)
│   └── api/contest-designer/route.ts— the one network route (Task 6)
├── components/
│   ├── Leaderboard.tsx (T3), MetricToggle.tsx (T3), ContestBanner.tsx (T3)
│   ├── BingoCard.tsx (T4), SubmissionForm.tsx (T4)
│   └── WheelCanvas.tsx (T5)
└── tests/
    ├── helpers.ts                   — createTestDb() with hand-built fixture
    ├── metrics.test.ts (T2), bingo.test.ts (T4), wheel.test.ts (T5)
```

---

### Task 1: Scaffold (Mon 7/13 — HQ ticket 1)

**Files:**
- Create: entire Next.js scaffold, `package.json` scripts, `.env.example`, `lib/db/client.ts`, `lib/db/schema.sql` (empty placeholder is NOT allowed — ship the real schema from Task 2's listing below, it's already final), `scripts/seed.ts` (stub that just initializes the schema), `vitest.config.ts`, one smoke test.

**Interfaces:**
- Produces: `getDb(path?: string): Database` — better-sqlite3 handle, default path `data/tablestakes.db`, `':memory:'` supported for tests. `initSchema(db): void` — executes `schema.sql` idempotently (`CREATE TABLE IF NOT EXISTS`).

- [ ] **Step 1:** `npx create-next-app@latest . --typescript --tailwind --app --no-src-dir` (accept defaults otherwise). Add deps: `npm i better-sqlite3 openai && npm i -D vitest @types/better-sqlite3 tsx`.
- [ ] **Step 2:** Wire `package.json` scripts: `"seed": "tsx scripts/seed.ts"`, `"test": "vitest run"`. Create `.env.example` with commented-out `OPENAI_API_KEY=` and `OPENAI_MODEL=gpt-5.6`.
- [ ] **Step 3:** Write `lib/db/schema.sql` (verbatim from Task 2 below), `lib/db/client.ts` with `getDb`/`initSchema`, and stub `scripts/seed.ts` that calls both and logs "schema ready".
- [ ] **Step 4:** Smoke test in `tests/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { initSchema } from '../lib/db/client';

describe('schema', () => {
  it('creates all 8 tables', () => {
    const db = new Database(':memory:');
    initSchema(db);
    const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`).all().map((r: any) => r.name).sort();
    expect(tables).toEqual(['bingo_cards','bingo_submissions','check_items','checks','contests','menu_items','servers','wheel_drawings']);
  });
});
```

- [ ] **Step 5:** Run `npm test` (expect PASS), `npm run seed` (expect "schema ready"), `npm run dev` (expect page loads). Commit: `feat: scaffold app, schema, db client`.

---

### Task 2: Seed + metrics (Tue 7/14 — HQ ticket 2)

**Files:**
- Create: `lib/types.ts`, `lib/rng.ts`, `lib/db/metrics.ts`, `lib/db/contests.ts`, `seed/fallback-contest.json`, `tests/helpers.ts`, `tests/metrics.test.ts`
- Modify: `scripts/seed.ts` (stub → full generator)

**Interfaces:**
- Consumes: `getDb`, `initSchema` (Task 1)
- Produces:

```ts
// lib/types.ts
export type MenuCategory = 'app' | 'entree' | 'dessert' | 'cocktail' | 'top_shelf' | 'na_bev';
export type MetricKey = 'ppa' | 'avg_check' | 'alcohol_pct' | 'attach_rate' | 'item_count' | 'large_party_ppa';
export interface ContestGoal {
  metric: MetricKey;
  category?: MenuCategory;   // attach_rate (category form)
  menu_item_id?: number;     // item_count, or attach_rate (item form)
  threshold?: number;        // absolute — exactly one of threshold / vs_house set
  vs_house?: boolean;        // qualify by beating house value
}
export interface ContestConfig {
  goals: ContestGoal[];
  bingo_pool: number[];      // >= 24 menu_item_ids
  entry_rules: { per_goal_met: number; per_bingo_win: number };
  prize: string;
}

// lib/db/metrics.ts — every fn takes the db handle first so tests inject :memory:
export interface ServerMetricRow { serverId: number; serverName: string; value: number; }
export function ppa(db: Database): ServerMetricRow[];
export function avgCheck(db: Database): ServerMetricRow[];
export function alcoholPct(db: Database): ServerMetricRow[];
export function attachRateByCategory(db: Database, category: MenuCategory): ServerMetricRow[];
export function attachRateByItem(db: Database, menuItemId: number): ServerMetricRow[];
export function itemCount(db: Database, menuItemId: number): ServerMetricRow[];
export function largePartyPpa(db: Database): ServerMetricRow[];        // party_size >= 6
export function metricRows(db: Database, goal: ContestGoal): ServerMetricRow[]; // dispatcher
export function houseValue(db: Database, goal: ContestGoal): number;   // same formula over ALL servers combined (NOT avg of per-server values)
export function goalQualifiers(db: Database, goal: ContestGoal): number[]; // serverIds where value > (goal.threshold ?? houseValue)

// lib/db/contests.ts
export function activeContest(db: Database): { id: number; name: string; week_start: string; config: ContestConfig; created_via: 'manual' | 'ai' } | null;
export function createContest(db: Database, name: string, weekStart: string, config: ContestConfig, via: 'manual' | 'ai'): number;
export function activateContest(db: Database, id: number): void; // sets status='active', closes any other active contest
```

**Schema (`lib/db/schema.sql`, final — Task 1 ships it verbatim):**

```sql
CREATE TABLE IF NOT EXISTS servers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS menu_items (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL CHECK (category IN ('app','entree','dessert','cocktail','top_shelf','na_bev')), price REAL NOT NULL, is_alcohol INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS checks (id INTEGER PRIMARY KEY, server_id INTEGER NOT NULL REFERENCES servers(id), opened_at TEXT NOT NULL, party_size INTEGER NOT NULL, subtotal REAL NOT NULL);
CREATE TABLE IF NOT EXISTS check_items (id INTEGER PRIMARY KEY, check_id INTEGER NOT NULL REFERENCES checks(id), menu_item_id INTEGER NOT NULL REFERENCES menu_items(id), qty INTEGER NOT NULL, price_each REAL NOT NULL);
CREATE TABLE IF NOT EXISTS contests (id INTEGER PRIMARY KEY, name TEXT NOT NULL, week_start TEXT NOT NULL, config_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','closed')), created_via TEXT NOT NULL DEFAULT 'manual' CHECK (created_via IN ('manual','ai')));
CREATE TABLE IF NOT EXISTS bingo_cards (id INTEGER PRIMARY KEY, contest_id INTEGER NOT NULL REFERENCES contests(id), server_id INTEGER NOT NULL REFERENCES servers(id), grid_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS bingo_submissions (id INTEGER PRIMARY KEY, card_id INTEGER NOT NULL REFERENCES bingo_cards(id), submitted_at TEXT NOT NULL DEFAULT (datetime('now')), marked_cells_json TEXT NOT NULL, lines_completed INTEGER NOT NULL, entries_awarded INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS wheel_drawings (id INTEGER PRIMARY KEY, contest_id INTEGER NOT NULL REFERENCES contests(id), drawn_at TEXT NOT NULL DEFAULT (datetime('now')), winner_server_id INTEGER NOT NULL REFERENCES servers(id), entries_snapshot_json TEXT NOT NULL);
```

**Metric formulas (SQL sketches — implement exactly):**

- ppa: `SELECT s.id, s.name, SUM(c.subtotal)/SUM(c.party_size) FROM checks c JOIN servers s ... GROUP BY s.id`
- avg_check: `SUM(c.subtotal)/COUNT(c.id)` per server
- alcohol_pct: `SUM(CASE WHEN mi.is_alcohol=1 THEN ci.qty*ci.price_each ELSE 0 END) / server subtotal sum` (join check_items→menu_items; denominator from checks.subtotal)
- attach_rate (category): `COUNT(DISTINCT CASE WHEN exists item of category THEN c.id END) * 1.0 / COUNT(DISTINCT c.id)` per server
- attach_rate (item): same with `ci.menu_item_id = ?`
- item_count: `SUM(ci.qty)` for the item per server
- large_party_ppa: ppa with `WHERE c.party_size >= 6`
- houseValue: same formula, no GROUP BY server.

**Seed (`scripts/seed.ts`) — deterministic core:**

```ts
import { mulberry32 } from '../lib/rng';
const rand = mulberry32(626); // fixed seed — same universe every run
// 1. DELETE all rows (idempotent reseed), then insert menu in category order so ids are stable:
//    apps 1-8, entrees 9-18, desserts 19-24, cocktails 25-32, top_shelf 33-36, na_bev 37-40.
// 2. 12 servers, each with a personality vector:
//    { alcoholAffinity: 0.3-1.8, dessertAffinity: 0.2-1.6, appAffinity: 0.4-1.5, ticketSize: 0.85-1.25 }
// 3. 4 weeks back from 2026-07-12: per server 4-5 shifts/week, 8-15 checks/shift,
//    party_size weighted small (1-10, ~70% under 5, occasional 6-10),
//    items per check ≈ party_size * (1.6-2.4), item picked by category roll biased by the
//    server's affinities, price_each = menu price, subtotal = Σ qty*price_each (exact).
// 4. Insert the fallback contest (seed/fallback-contest.json) as status='active',
//    generate a bingo card per server (Task 4's generateCard — until Task 4 lands, skip
//    cards gracefully if the module doesn't exist yet... NO: cards are Task 4. In Task 2
//    the seed creates servers/menu/checks/contest ONLY. Task 4 extends the seed.
```

**`seed/fallback-contest.json` (write verbatim):**

```json
{
  "goals": [
    { "metric": "ppa", "vs_house": true },
    { "metric": "attach_rate", "category": "dessert", "threshold": 0.25 },
    { "metric": "alcohol_pct", "vs_house": true }
  ],
  "bingo_pool": [1,2,3,4,5,6,7,8,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36],
  "entry_rules": { "per_goal_met": 1, "per_bingo_win": 1 },
  "prize": "First pick of weekend sections + $50"
}
```

(26 ids: all apps, desserts, cocktails, top_shelf — valid against the stable seed ids.)

**`lib/rng.ts` (write verbatim):**

```ts
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 1:** Write `tests/helpers.ts` `createTestDb()`: in-memory db, initSchema, then a hand-built fixture — 2 servers (Ana id 1, Bo id 2); menu: item 1 'Wings' app 12.00, item 19 'Lava Cake' dessert 8.00, item 25 'Margarita' cocktail 12.00 is_alcohol=1; checks: A(server 1, party 2, subtotal 40, items: Wings x1 @12, Margarita x1 @12, misc-free — subtotal stored as 40 with a filler entree row id 9 'Burger' 16.00 x1), B(server 1, party 4, subtotal 60, items: Burger x2 @16, Lava Cake x1 @8, Wings x1 @12 → 52? — make items sum EXACTLY: use Burger x3 @16 + Lava Cake x1 @8 + no wings = 56... simplest correct fixture: subtotal MUST equal Σ items; build items first, compute subtotal). Fixture (final): 
  - Check A: server 1, party 2 — Wings x1 (12) + Burger x1 (16) + Margarita x1 (12) = **subtotal 40**
  - Check B: server 1, party 4 — Burger x3 (48) + Lava Cake x1 (8) = **subtotal 56**
  - Check C: server 2, party 6 — Burger x4 (64) + Margarita x2 (24) = **subtotal 88**
- [ ] **Step 2:** Write `tests/metrics.test.ts` with hand-computed expectations, then run — expect FAIL (functions don't exist):

```ts
// server 1: ppa = (40+56)/(2+4) = 16;  avg_check = 96/2 = 48;  alcohol_pct = 12/96 = 0.125
// dessert attach = 1/2 = 0.5;  wings item_count = 1;  large_party_ppa: no rows (no party>=6)
// server 2: ppa = 88/6 ≈ 14.6667;  alcohol_pct = 24/88 ≈ 0.2727;  large_party_ppa = 88/6
// house ppa = (96+88)/(6+6) ≈ 15.3333 → goalQualifiers({metric:'ppa',vs_house:true}) === [1]
expect(ppa(db).find(r => r.serverId === 1)!.value).toBeCloseTo(16, 4);
expect(goalQualifiers(db, { metric: 'ppa', vs_house: true })).toEqual([1]);
expect(attachRateByCategory(db, 'dessert').find(r => r.serverId === 1)!.value).toBeCloseTo(0.5, 4);
```

- [ ] **Step 3:** Implement `lib/types.ts`, `lib/rng.ts`, `lib/db/metrics.ts`, `lib/db/contests.ts` until tests pass. Run `npm test` — expect PASS.
- [ ] **Step 4:** Implement the full seed per the sketch (servers/menu/checks/active fallback contest — no bingo cards yet). Run `npm run seed` twice — second run must not duplicate rows (idempotent). Sanity: `SELECT COUNT(*) FROM checks` in the 1500–3500 range.
- [ ] **Step 5:** Commit: `feat: schema, seeded universe, metric queries with tests`.

---

### Task 3: Dashboard (Wed 7/15 — HQ ticket 3)

**Files:**
- Create: `components/Leaderboard.tsx`, `components/MetricToggle.tsx`, `components/ContestBanner.tsx`
- Modify: `app/page.tsx`, `app/layout.tsx` (nav shell: Dashboard · Contest · Bingo · Wheel)

**Interfaces:**
- Consumes: `metricRows`, `houseValue`, `goalQualifiers`, `activeContest` (Task 2); `dailyWinsByServer` arrives in Task 4 — render the column with 0s from a local stub `const dailyWins: Record<number, number> = {}` and a `// Task 4 replaces with dailyWinsByServer(db)` marker (the ONE allowed forward reference).
- Produces: page structure other tasks link to; no exported code consumed later.

**Behavior contract:**
- Server component reads db directly. Metric toggle = URL search param (`/?metric=ppa`, default `ppa`; values: ppa, avg_check, alcohol_pct, dessert_attach, app_attach, item counts get a select of menu items only if trivial — otherwise ship the 5 fixed toggles and skip per-item toggling, YAGNI).
- Row: rank, server name + color dot, metric value (formatted: currency for ppa/avg_check, percent for rates), delta vs house (green ▲ / red ▼), qualification badges (one per contest goal met, tooltip = goal description), daily-wins tally.
- ContestBanner: name, human-readable goals, prize, days remaining (from week_start + 7 vs today).
- Sorted descending by the active metric.

- [ ] **Step 1:** Build layout nav + ContestBanner + Leaderboard + MetricToggle per contract.
- [ ] **Step 2:** Manual verify against seed: pick one server, hand-compute their PPA from the db (`sqlite3 data/tablestakes.db "SELECT SUM(subtotal)/SUM(party_size) FROM checks WHERE server_id=3"`), confirm the page shows the same number. Toggle each metric — board reorders, no console errors.
- [ ] **Step 3:** Commit: `feat: dashboard leaderboard, metric toggles, contest banner`.

---

### Task 4: Server Bingo (Thu 7/16 — HQ ticket 4)

**Files:**
- Create: `lib/db/bingo.ts`, `components/BingoCard.tsx`, `components/SubmissionForm.tsx`, `app/bingo/page.tsx`, `app/bingo/print/[cardId]/page.tsx`, `tests/bingo.test.ts`
- Modify: `scripts/seed.ts` (add: card per server + 3 submissions, 2 of them daily wins), `app/page.tsx` (swap daily-wins stub for real query)

**Interfaces:**
- Consumes: `activeContest` (Task 2)
- Produces:

```ts
// lib/db/bingo.ts
export type Cell = number | 'FREE';                       // menu_item_id or FREE
export function generateCard(pool: number[], rand: () => number): Cell[];  // length 25, [12]==='FREE', 24 unique ids from pool; throws if pool.length < 24
export function completedLines(marked: boolean[]): number; // marked.length 25, marked[12] treated as true; counts of the 12 lines (5 rows, 5 cols, 2 diagonals) fully marked
export function createCardForServer(db: Database, contestId: number, serverId: number): number; // regenerates: deletes server's existing card for contest, inserts new
export function cardsForContest(db: Database, contestId: number): { id: number; serverId: number; serverName: string; grid: Cell[] }[];
export function logSubmission(db: Database, cardId: number, marked: boolean[]): { linesCompleted: number; isDailyWin: boolean; entriesAwarded: number };
// entriesAwarded = isDrawingActive(contest) ? entry_rules.per_bingo_win : 0  (import from wheel.ts — Task 5; until Task 5 lands, inline `const drawingActive = !db.prepare('SELECT 1 FROM wheel_drawings WHERE contest_id=?').get(contestId)` — same definition, Task 5 centralizes it)
export function dailyWinsByServer(db: Database, contestId: number): Record<number, number>; // count of submissions with lines_completed >= 1
export function submissions(db: Database, contestId: number): { id: number; serverName: string; submittedAt: string; linesCompleted: number; entriesAwarded: number }[];
```

- [ ] **Step 1:** Write `tests/bingo.test.ts`, run, expect FAIL:

```ts
import { mulberry32 } from '../lib/rng';
const pool = Array.from({ length: 30 }, (_, i) => i + 1);
it('24 unique items, FREE center', () => {
  const card = generateCard(pool, mulberry32(1));
  expect(card).toHaveLength(25);
  expect(card[12]).toBe('FREE');
  const ids = card.filter(c => c !== 'FREE') as number[];
  expect(new Set(ids).size).toBe(24);
  ids.forEach(id => expect(pool).toContain(id));
});
it('throws on pool < 24', () => expect(() => generateCard([1,2,3], mulberry32(1))).toThrow());
it('two cards differ', () => expect(generateCard(pool, mulberry32(1))).not.toEqual(generateCard(pool, mulberry32(2))));
it('counts lines with FREE', () => {
  const marked = Array(25).fill(false);
  [10,11,13,14].forEach(i => marked[i] = true);        // middle row minus center
  expect(completedLines(marked)).toBe(1);               // FREE completes it
  [2,7,17,22].forEach(i => marked[i] = true);           // middle column minus center
  expect(completedLines(marked)).toBe(2);
});
it('full card = 12 lines', () => expect(completedLines(Array(25).fill(true))).toBe(12));
```

- [ ] **Step 2:** Implement `lib/db/bingo.ts` (Fisher-Yates shuffle of the pool with the injected rand, take 24, splice FREE at 12). Run `npm test` — PASS.
- [ ] **Step 3:** Build `/bingo`: card list (mini-grid per server, item names from menu), Re-randomize button (server action → `createCardForServer`), Print link per card. Print page renders ONE card: contest name, server name, week, 5×5 grid with item names, and:

```css
@media print {
  nav, .no-print { display: none !important; }
  .bingo-print { page-break-inside: avoid; width: 100%; font-size: 12pt; }
  @page { margin: 0.5in; }
}
```

- [ ] **Step 4:** Build SubmissionForm: pick a card, click cells to mark, submit → `logSubmission` → toast showing lines/daily win/entries; submissions table below. Swap the dashboard daily-wins stub for `dailyWinsByServer`.
- [ ] **Step 5:** Extend seed: one card per server, 3 submissions (2 with ≥1 line). Reseed, verify `/bingo` alive on first run and dashboard tally shows the wins. Print-preview a card: one page, legible.
- [ ] **Step 6:** Commit: `feat: server bingo — cards, print, submissions, daily wins`.

---

### Task 5: Prize wheel (Fri 7/17 — HQ ticket 5)

**Files:**
- Create: `lib/db/wheel.ts`, `components/WheelCanvas.tsx`, `app/wheel/page.tsx`, `tests/wheel.test.ts`
- Modify: `lib/db/bingo.ts` (`logSubmission` imports `isDrawingActive` instead of inline query), `scripts/seed.ts` (add one drawing on a *closed* past contest so history renders; the active contest keeps its drawing open)

**Interfaces:**
- Consumes: `goalQualifiers` (T2), `dailyWinsByServer` + submissions data (T4)
- Produces:

```ts
// lib/db/wheel.ts
export function isDrawingActive(db: Database, contestId: number): boolean; // contest.status==='active' && no wheel_drawings row for it
export function wheelEntries(db: Database, contestId: number): { serverId: number; name: string; color: string; entries: number }[];
// entries = goalsMet * per_goal_met + Σ(submission.entries_awarded)  — NOTE: use the stored entries_awarded
// (awarded-at-submission-time), NOT recomputed daily wins; this is what makes "earned while the
// drawing was active" true by construction. Filter entries > 0.
export function recordDrawing(db: Database, contestId: number, winnerServerId: number): void; // stores entries snapshot JSON
export function drawings(db: Database): { drawnAt: string; contestName: string; winnerName: string }[];
```

- [ ] **Step 1:** Write `tests/wheel.test.ts` on the fixture db + a contest with known config; assert: qualifier-only server gets `per_goal_met` entries; a logged winning submission adds `per_bingo_win`; after `recordDrawing`, `isDrawingActive` is false and a new submission's `entriesAwarded` is 0 while `dailyWinsByServer` still increments. Run — FAIL.
- [ ] **Step 2:** Implement `lib/db/wheel.ts`; refactor bingo's inline check to import `isDrawingActive`. Run `npm test` — PASS (bingo tests must still pass).
- [ ] **Step 3:** WheelCanvas (client component, `<canvas>`): slices proportional to entries, server colors, labels. Spin: `requestAnimationFrame`, total rotation = 4 + rand*2 full seconds, ease-out cubic `1 - (1-t)^3`, final angle chosen by weighted random pick FIRST, then animate to it (never derive the winner from the animation). Respect `prefers-reduced-motion`: skip animation, announce winner immediately.
- [ ] **Step 4:** `/wheel` page: TV mode (full-viewport, big type), entry list, Spin button → animation → winner banner → `recordDrawing`. History section from `drawings`. Empty state when no active drawing: "No drawing open — activate a contest."
- [ ] **Step 5:** Verify reconciliation: entries on the wheel page match dashboard badges + bingo log by hand-count for 2 servers. Reseed and confirm history shows the past drawing. Commit: `feat: prize wheel — entries, TV mode, drawing history`.

---

### Task 6: Contest Designer (Sat 7/18 — HQ ticket 6)

**Files:**
- Create: `app/api/contest-designer/route.ts`, `app/contest/page.tsx`, `lib/contest-schema.ts`
- Modify: none

**Interfaces:**
- Consumes: `createContest`, `activateContest` (T2); menu + metric queries for the stats summary
- Produces: `POST /api/contest-designer` — body `{ prompt: string }` → `200 { config: ContestConfig, source: 'ai' | 'fallback', note?: string }`. Never non-200 for a missing key.

**Contract:**
- `lib/contest-schema.ts` exports the JSON Schema for `ContestConfig` (goals enum matches `MetricKey`; `bingo_pool` minItems 24; `entry_rules` required) and `validateConfig(config, db): string[]` — checks every `bingo_pool` id and `menu_item_id` exists in `menu_items`, exactly one of threshold/vs_house per goal.
- Route logic: no `OPENAI_API_KEY` → return fallback JSON with `source: 'fallback'`, `note: 'sample config (no API key)'`. With key: call the OpenAI API (official `openai` npm package — **Codex: use the current SDK's structured-output mechanism with the exported JSON Schema; follow current OpenAI docs, model from `process.env.OPENAI_MODEL ?? 'gpt-5.6'`**). System prompt: you design weekly restaurant sales contests; input = manager goal + menu (id/name/category/price) + 4-week per-server summary (ppa, avg_check, alcohol_pct, category attach rates) + house values + item sales counts; weight `bingo_pool` toward underselling items relevant to the goal; thresholds slightly above house. On invalid config: retry once with the validation errors appended; second failure → fallback with `note: 'AI config failed validation — sample config loaded'`.
- `/contest` page: prompt textarea → calls route → editable review form (goals rows, bingo pool as checkable menu-item chips grouped by category, entry rules, prize) → "Activate contest" → `createContest` + `activateContest`, redirect to dashboard.

- [ ] **Step 1:** Write `lib/contest-schema.ts` + validator; quick Vitest cases for validator (bad id caught, pool of 23 caught).
- [ ] **Step 2:** Route with fallback path first; verify with no key: `curl -s -X POST localhost:3000/api/contest-designer -H 'content-type: application/json' -d '{"prompt":"x"}'` → `source: "fallback"`.
- [ ] **Step 3:** AI path with key in `.env.local`; prompt "push desserts and top-shelf this week" → config references real ids, pool ≥ 24, plausibly dessert/top-shelf-weighted.
- [ ] **Step 4:** Build `/contest` page per contract; activate an AI config; confirm dashboard badges, bingo pools (new cards use the new pool), and wheel re-derive.
- [ ] **Step 5:** Commit: `feat: GPT-5.6 contest designer with no-key fallback`.

---

### Task 7: Polish + README (Sun 7/19 — HQ ticket 7)

**Files:**
- Create: `README.md`, `LICENSE` (MIT), `docs/screenshots/` (dashboard, printed card, wheel)
- Modify: visual passes on `/wheel`, `/bingo/print`, `/` in that order; empty states everywhere

- [ ] **Step 1:** Polish priority: wheel TV mode → printed card → dashboard hierarchy → empty states, console warnings.
- [ ] **Step 2:** README for a judge: what it is, 3-command setup, what the seed contains, screenshots, `OPENAI_API_KEY` optional + fallback note, Codex/GPT-5.6 build story (2 sentences).
- [ ] **Step 3:** Fresh-clone dry run: clone to a temp dir, `npm install && npm run seed && npm run dev`, walk all 4 pages, `npm test`. Fix anything that snags.
- [ ] **Step 4:** Commit: `docs: README, license, screenshots; polish pass`.

---

### Task 8: Camera-ready + submit (Mon 7/20 – Tue 7/21 — HQ tickets 8–9)

- [ ] **Step 1:** Walk the exact demo arc (designer → dashboard → print → submission → spin); fix stutters only, no features. Commit: `fix: camera-ready pass`.
- [ ] **Step 2:** Record per the HQ shot list, edit <3:00, upload public YouTube.
- [ ] **Step 3:** Push repo public; confirm ⭐ core session ID in `SUBMISSION.md`; Devpost form (category: Work and productivity) submitted by **noon PT Tue 7/21**.

---

## Plan self-review notes

- Spec coverage: all 4 features, seed, metrics (7 incl. both attach forms), daily-win model, drawing-active definition, fallback, print, TV mode, non-goals honored, calendar mapped 1:1 to HQ tickets. Per-item metric *toggling* on the dashboard deliberately reduced to fixed toggles (YAGNI) — goals still support item metrics via badges.
- Forward references: two, both explicit and resolved (dashboard daily-wins stub → T4; bingo inline drawing-check → T5 centralizes). No others.
- Type consistency: config keys snake_case end-to-end; TS interfaces camelCase for function returns only.
