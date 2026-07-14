# SIM: Sales Incentive Machine — agent instructions

A sales-contest platform for restaurant managers: server leaderboards against sales goals, printable Server Bingo cards on menu items, and a weekly prize-wheel drawing. Hackathon project for OpenAI Build Week; deadline July 21, 2026.

**The full spec is `docs/superpowers/specs/2026-07-13-sim-design.md`. Read it before building anything. It defines the data model, exact metric formulas, contest config shape, feature acceptance criteria, and the cut list. When this file and the spec disagree, the spec wins.**

## Stack

- Next.js (App Router) + TypeScript + Tailwind. No component libraries.
- SQLite via `better-sqlite3`, direct SQL. DB at `data/sim.db` (gitignored).
- Vitest for unit tests.

## Commands

- `npm run dev` — start the app
- `npm run seed` — reset + regenerate the database (deterministic, fixed RNG seed)
- `npm test` — run unit tests

## Hard rules

- **Local-first, zero config.** `npm install && npm run seed && npm run dev` must always work on a fresh clone with no environment variables. Judges will do exactly this.
- **The no-key fallback is sacred.** `OPENAI_API_KEY` is optional. Without it, the Contest Designer serves `seed/fallback-contest.json` and every feature stays fully demoable. Never let a missing key throw.
- **No secrets in the repo.** Keys live in `.env.local` only.
- **Metrics are computed in queries, never stored.** Formulas are in the spec — implement them exactly and keep them unit-tested.
- **Fake data only.** No real restaurant, brand, menu, or person names anywhere.
- **Respect the non-goals.** No auth, multi-restaurant, POS integration, deployment, or notifications. Don't scaffold for them "just in case."

## Conventions

- Small focused components; server components by default, client components only where interaction demands.
- Plain, readable SQL in a `lib/db/` module — one function per query, typed returns.
- Print stylesheet for bingo cards renders one clean card per page: no nav, no buttons, legible at arm's length.
- Commit style: conventional commits (`feat:`, `fix:`, `chore:`).

## Definition of done (per feature)

Feature acceptance criteria in the spec pass, `npm test` is green, `npm run seed && npm run dev` on a clean tree shows the feature working with seed data, and no console errors on the touched pages.
