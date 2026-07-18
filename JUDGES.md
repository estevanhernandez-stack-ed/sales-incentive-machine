# Judging guide

A five-minute path through SIM, plus where to look for the Codex and GPT-5.6 work.

## Fastest way to run it

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/estevanhernandez-stack-ed/sales-incentive-machine)

Click the badge. The container installs dependencies, seeds the database, and starts the app on forwarded port 3000. If the preview does not open by itself, run `npm run dev` in the terminal; setup is already finished by then.

Verified end to end in a fresh Codespace: dependencies install, the native SQLite module loads, the seed produces 12 servers, 40 menu items, and 2,461 checks, and every page returns 200.

## Or run it locally

```bash
npm install
npm run seed
npm run dev
```

Open `http://127.0.0.1:3000`. Node 22 or newer. No API key, no account, no environment variables. Everything below works without a key.

## Five-minute tour

1. **Dashboard** (`/`). Every server ranked against the active contest. Switch the performance lens and watch the ranking recompute. The active prize, target, last winner, and deadline stay pinned.
2. **Contest setup** (`/contest`). The AI surface. Describe a contest in plain words and GPT-5.6 returns a complete configuration: goals, Bingo pool, entry rules, games, and prize. Without a key it loads a versioned sample config labeled "Sample config (no API key)" and everything downstream still works. Review the draft, then activate it.
3. **Server Bingo** (`/bingo`). Randomized five-by-five cards drawn from the active contest's menu pool. Mark a few cells, then use **Print cards** to see the print stylesheet: one clean card per page, no navigation, legible at arm's length.
4. **Sales games** (`/games`). The same live totals driving a floor race and a shared goal board. Final awards convert into prize-wheel entries.
5. **Sales data** (`/data`). Shift-side entry of contest quantities without inventing check data, spreadsheet import, and an audit trail that preserves corrections.
6. **Prize wheel** (`/wheel`). The contender panel explains exactly why each server holds the entries they hold. Spin it. **The draw resolves and is saved before the wheel animates** — the animation reports a recorded result rather than producing one, so the drawing is auditable after the fact.

## Where the AI work is

| What | Where |
|---|---|
| GPT-5.6 contest generation, strict JSON schema, retry, fallback | `app/api/contest-designer/route.ts` |
| Versioned fallback config used when no key is present | `seed/fallback-contest.json` |
| MCP server: role-aware operations with receipts and evidence | `mcp/sim-ops-server.mjs`, `mcp/sim-ops-core.mjs` |
| MCP server: synthetic point-of-sale feed | `mcp/boh-pos-server.mjs` |
| Agent-executable runbooks (human docs and agent scripts in one) | `runbooks/` |
| Specification the build was written against | `docs/superpowers/specs/2026-07-13-sim-design.md` |
| Versioned prompt that generated the demo-video pipeline | `docs/prompts/demo-video.md` |
| Codex session IDs per build thread | `SUBMISSION.md` |

A fuller writeup of how Codex and GPT-5.6 were used is in the README.

## Verifying the build

```bash
npm test        # 45 unit tests, including every metric formula
npm run build   # production build
```

## Notes

- All restaurant, server, menu, check, and contest data is fictional.
- No auth, no multi-restaurant support, no POS integration, and no deployment step. These are documented non-goals, not omissions; SIM is deliberately a local-first single-restaurant tool.
- Metrics are always computed in SQL queries and never stored, so no number on screen can drift from the sales records behind it.
- To exercise the live GPT-5.6 path, add `OPENAI_API_KEY=sk-...` to `.env.local` and restart. The fallback path is the default and is fully functional.
