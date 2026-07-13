# TableStakes — design spec

> Here's what I was thinking.
>
> A sales-contest platform for restaurant managers: track servers against sales goals, run Server Bingo on menu items, and draw weekly winners on a live prize wheel. Built for OpenAI Build Week (Devpost), category **Work and productivity**. All data is fake by construction — fake menu, fake servers, generated stats. This document is the complete brief; nothing else is required context.

## Hackathon constraints (non-negotiable)

- **Deadline:** Tuesday, July 21, 2026, 5:00 PM PT. Target submission Monday July 20 / Tuesday morning — leave buffer.
- **Built with Codex using GPT-5.6.** Core functionality must be built in Codex sessions. Capture the `/feedback` Codex Session ID from the thread where the majority of core functionality was built — it is a required submission field. Log session IDs in `SUBMISSION.md` as you go.
- **Deliverables:** working project, public repo, README with setup instructions and sample data, <3-minute public YouTube demo video, category selection.
- **In-product GPT-5.6 is NOT required** by the rules. The Contest Designer feature (below) is a judging-strategy choice and is the designated cut if time runs short.

## Product

**TableStakes** (working title). Primary user: a restaurant manager running weekly sales contests. Servers never log in — their surfaces are a printed bingo card and a wheel spinning on the break-room TV.

The pitch: sales contests today are spreadsheet chaos. TableStakes ingests sales data, shows who's beating the goals, generates per-server bingo cards from the items you want pushed, logs turned-in cards, and rewards qualifiers with a live prize-wheel drawing.

## Stack

- **Next.js (App Router) + TypeScript + Tailwind.** One framework, API routes included.
- **SQLite** via `better-sqlite3` (no ORM ceremony; direct SQL is fine for 8 tables). DB file lives at `data/tablestakes.db`, gitignored.
- **Local-first.** Judges run: `npm install && npm run seed && npm run dev`. No cloud config, no auth.
- **Tests:** Vitest, targeted only — metric math and bingo generation. No E2E.
- `.env.local` holds `OPENAI_API_KEY` (optional) and `OPENAI_MODEL` (default `gpt-5.6`). Never committed. The app must be fully demoable with no key present.

## Data model

| Table | Fields |
|---|---|
| `servers` | id, name, color (avatar hue), active |
| `menu_items` | id, name, category (`app` / `entree` / `dessert` / `cocktail` / `top_shelf` / `na_bev`), price, is_alcohol |
| `checks` | id, server_id, opened_at, party_size, subtotal (set at seed time = sum of its check_items; queries read it directly, never recompute) |
| `check_items` | id, check_id, menu_item_id, qty, price_each |
| `contests` | id, name, week_start, config_json, status (`draft` / `active` / `closed`), created_via (`manual` / `ai`) |
| `bingo_cards` | id, contest_id, server_id, grid_json (25 cells, index 12 = FREE), created_at |
| `bingo_submissions` | id, card_id, submitted_at, marked_cells_json, lines_completed, entries_awarded |
| `wheel_drawings` | id, contest_id, drawn_at, winner_server_id, entries_snapshot_json |

Metrics are **computed in queries, never stored** — no sync drift.

### Metric definitions (industry-standard restaurant BI names, exact formulas)

- **PPA (per-person average, a.k.a. per-guest average):** sum(subtotal) / sum(party_size)
- **Average check:** sum(subtotal) / count(checks)
- **Beverage/alcohol sales %:** sum(alcohol item revenue) / sum(subtotal)
- **Attachment rate (per category):** count(checks containing >= 1 item of category) / count(checks) — e.g. dessert attach, appetizer attach
- **Attachment rate (per item):** count(checks containing the item) / count(checks)
- **Item count:** total qty of a given menu_item sold
- **Large-party PPA:** PPA over checks where party_size >= 6
- **House average:** the same metric over all servers combined; a server "beats house" when their value exceeds it

### Contest config shape (`config_json`)

```json
{
  "goals": [
    { "metric": "ppa" | "avg_check" | "alcohol_pct" | "attach_rate" | "item_count" | "large_party_ppa",
      "category": "dessert",         // attach_rate only (category form)
      "menu_item_id": 12,            // item_count or attach_rate (item form)
      "threshold": 21.5,             // absolute, OR:
      "vs_house": true }             // qualify by beating house average
  ],
  "bingo_pool": [3, 7, 12, 18],      // menu_item_ids eligible for card cells — example truncated; a real pool MUST contain >= 24 ids
  "entry_rules": { "per_goal_met": 1, "per_bingo_win": 1 },
  "prize": "Friday night off + $50"
}
```

## Seed script (`npm run seed`)

Deterministic (fixed RNG seed). Generates:

- ~40 menu items across all six categories, plausible names and prices.
- 12 servers with names and avatar colors.
- 4 weeks of checks: each server works 4–5 shifts/week, 8–15 checks/shift, party sizes 1–10 weighted small, items per check scale with party size. Build in personality: some servers oversell cocktails, some never sell desserts — the leaderboard must have texture, not noise.
- One active contest (from `seed/fallback-contest.json`) plus bingo cards for all 12 servers, 2–3 logged submissions, and one past wheel drawing — so every screen has life on first run.

## Features (build order = priority order)

### 1. Dashboard (`/`)

- Leaderboard of servers with metric toggle (PPA / average check / alcohol % / attach rates / item counts) plus a daily-wins tally column.
- Each row: server, metric value, delta vs house average, qualification badges per contest goal.
- Active contest banner: name, goals, prize, days remaining.
- **Accept:** toggling metrics reorders the board; qualifiers visibly badged; numbers match hand-computed values from seed data (unit-tested).

### 2. Server Bingo (`/bingo`)

- Card grid per server: 5×5, center FREE, 24 items drawn from the contest's `bingo_pool`, no duplicates, every card a different random arrangement.
- Buttons: **Re-randomize** (new grid, same server) and **Print** — print stylesheet renders one clean card per page (card name, server name, week; no app chrome).
- Submission logging: manager marks which cells a turned-in card completed; app computes lines (rows, columns, diagonals; FREE counts), logs who and when.
- **Bingo reward model:** a submission with >= 1 completed line is a **daily contest win** — always logged and celebrated (daily-wins tally on the dashboard and bingo page), independent of the wheel. If a weekly wheel drawing is active, the daily win ALSO awards wheel entries per `entry_rules.per_bingo_win`; if no drawing is active, the daily win stands alone.
- **Accept:** no card ever has duplicate items (unit-tested); print preview is one page, legible; a winning submission always increments the server's daily-wins tally, and increments wheel entries only while a drawing is active.

### 3. Prize wheel (`/wheel`)

- Wheel auto-populates: every server's entry count = goals met (per `entry_rules.per_goal_met`) + bingo daily wins earned while the drawing was active (per `entry_rules.per_bingo_win`). More entries = more wheel slices.
- **Drawing "active" definition:** the weekly drawing is active while a contest has status `active` and no `wheel_drawings` row exists for it yet. After the spin, the drawing is done — later bingo wins are daily wins only.
- **TV mode:** full-screen, big type, readable from across a break room.
- Animated spin (CSS/JS, 4–6 seconds, decelerating), winner banner, drawing saved to history with an entries snapshot.
- **Accept:** entry counts match dashboard qualifications + logged submissions; spin lands on a random slice weighted by entries; history persists.

### 4. Contest Designer (`/contest`) — GPT-5.6 in-product, THE CUT LINE

- Manager types a goal in plain English: *"push appetizers and top-shelf tequila this week."*
- `POST /api/contest-designer`: sends the prompt + menu + 4-week per-server stats summary to GPT-5.6 with a JSON schema (structured output) matching the contest config shape. Model reasons about which items are underselling and weights the bingo pool toward them.
- Manager reviews the generated config in an editable form, then activates it. Everything downstream (dashboard badges, bingo pools, wheel entries) re-derives from the new config.
- **No-key fallback:** without `OPENAI_API_KEY`, the endpoint returns `seed/fallback-contest.json` labeled "sample config (no API key)" — every feature stays demoable.
- **Accept:** with a key, prompt → valid config that references real menu item ids; without a key, fallback loads and the app never errors.

## Non-goals (do not build)

No auth. No multi-restaurant. No POS integration. No server-facing accounts. No deployment (local only). No mobile app. No email/notifications.

## Design notes

Neutral hospitality branding — warm, confident, a little playful (it's a contest tool). Dark-friendly. The wheel and the printed card are the two money shots in the demo video: spend polish there. Tailwind only, no component libraries.

## Demo video arc (<3 min)

1. Problem beat: sales contests are spreadsheet chaos (10s).
2. Type the goal into Contest Designer → config appears (30s).
3. Dashboard: leaderboard, badges, who's qualifying (30s).
4. Print a bingo card on camera, hold it up (20s).
5. Log a turned-in card → entries tick up (20s).
6. TV mode: wheel spins, winner banner (30s).
7. End card: built with Codex + GPT-5.6 (5s).

## Calendar (evenings + weekend, ~15–25h)

| Day | Work |
|---|---|
| Mon 7/13 (tonight) | Register on Devpost, **request free credits** (gate: Fri 7/17 noon PT), install Codex + sign in, watch launch livestream/replay, first Codex session: scaffold Next.js app from this spec |
| Tue 7/14 | Seed script + data model + metric queries — PPA, average check, alcohol %, attach rates, item count, large-party (unit tests here) |
| Wed 7/15 | Dashboard |
| Thu 7/16 | Bingo: generation, print CSS, submissions |
| Fri 7/17 | Prize wheel + TV mode |
| Sat 7/18 | Contest Designer + fallback |
| Sun 7/19 | Design polish pass, README, seed-data texture |
| Mon 7/20 | Record + edit video, submission dry run |
| Tue 7/21 | Submit by noon PT (deadline 5 PM PT). Capture /feedback session ID first |

## Submission checklist

- [ ] Devpost registration + credits requested (by Fri 7/17 noon PT)
- [ ] Public GitHub repo, licensed
- [ ] README: setup, `npm run seed` sample data, screenshots
- [ ] <3-min public YouTube demo video
- [ ] `/feedback` Codex Session ID captured in SUBMISSION.md
- [ ] Category: Work and productivity
- [ ] Submitted with buffer before Tue 7/21 5 PM PT
