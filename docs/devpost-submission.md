# Devpost submission copy — SIM: Sales Incentive Machine

Paste-ready text for each Devpost field. Fictional data only; no employer named.

---

## Project story

### Inspiration

I had been meaning to scaffold this one for a while. The idea started at my day job, where sales contests are a real thing that runs on whiteboards, spreadsheets, and whoever remembers what changed. I had also started sketching a version of it for a gaming group, as a scoreboard for friendly competition. Neither version got far, because "someday" projects rarely do.

Build Week was the forcing function. It let me restart from zero, aim the idea at restaurant sales where the mechanics are sharpest, and use the whole thing as a real test of what Codex and GPT-5.6 can carry. A hackathon deadline is a better project manager than good intentions.

### What it does

SIM runs a weekly sales contest for a restaurant floor team, end to end.

Managers set a goal and a prize, then describe the contest they want in plain words. GPT-5.6 turns that into a validated contest configuration. Servers compete on a live dashboard that ranks them across sales metrics, contest goals, and daily Bingo wins. Shift leaders log contest quantities and returned Bingo cards during service. Everything funnels into one auditable prize drawing at the end of the week.

The pieces:

- **Live dashboard.** Every server ranked against the active contest, with switchable performance lenses, current prize, target, last winner, and deadline always visible.
- **AI Contest Designer.** A manager's plain-words goal becomes a validated contest config: GPT-5.6 structured output under a strict JSON schema, then local validation of every menu ID and contest rule.
- **Printable Server Bingo.** Randomized five-by-five cards drawn from the active contest's menu pool, one clean card per page, legible at arm's length.
- **Sales games.** The same live totals drive a visible floor race and a shared goal board. Final awards convert into wheel entries.
- **Auditable prize wheel.** The draw resolves and saves an immutable snapshot first. Only then does the wheel animate toward the already-recorded winner. The show stays exciting without letting the animation decide anything.
- **Sales data entry and import.** Shift leaders add contest-only quantities without inventing check data, and managers import their own sales through a shared spreadsheet schema. Corrections are preserved in an audit trail.

Every screen works on a fresh clone with no API key and no account. All data shown is fictional.

### How I built it

Next.js 15 App Router with TypeScript and Tailwind, React 19, SQLite through better-sqlite3 with plain readable SQL, Vitest for the metric formulas. Local-first by design: `npm install && npm run seed && npm run dev` and you have a working app. No auth, no cloud, no deployment step, no POS integration.

I wrote a specification first, then built it in Codex sessions against that spec. The spec defined the data model, the exact metric formulas, the contest config shape, and a cut list of things explicitly not being built. Having the cut list in writing mattered more than I expected; it was the thing I pointed at whenever a session started drifting toward scope that would not ship by Tuesday.

Two rules shaped most of the architecture. Metrics are always computed in queries and never stored, so no number on screen can drift from the sales records behind it. And the no-key fallback is sacred: if `OPENAI_API_KEY` is missing, the Contest Designer serves a versioned sample config instead of throwing, so the whole product stays demoable for anyone who just cloned it.

**The MCP angle.** This is the part I did not expect going in. I built two local MCP servers so an agent could operate the app the way a manager or shift leader actually would:

- `sim_boh_pos` records fully itemized fictional closed checks as a synthetic point-of-sale feed.
- `sim_ops` reads runbooks and current state, previews irreversible operations before committing them, executes role-aware idempotent operations, and returns receipts plus screenshot paths.

On top of those, the repo carries canonical JSON runbooks that are both human documentation and agent-executable scripts. An agent can run the Contest Manager or Shift Manager workflow end to end against a disposable copy of the database, produce reconciled receipts and screenshot evidence, and hand back a run package that a verifier script checks for structural completeness. It is a way of testing an app through its actual operator workflows instead of through unit tests alone. Both MCP servers are local STDIO processes, and `sim_ops` refuses to talk to anything that is not localhost.

The demo video is built the same way: `demo/manifest.json` is the scene plan, a capture script drives Playwright against the running app, and an FFmpeg renderer assembles the master. The prompt that specified that pipeline is versioned in the repo next to the code it produced.

### Challenges I ran into

**Keeping the demo honest.** Early on it was tempting to record the Contest Designer with a key configured and quietly skip what happens without one. Instead the video shows a live API response and states the fallback behavior plainly. The fallback is a feature, not an embarrassment, and pretending otherwise would have made the whole demo less trustworthy.

**Animation cannot decide the outcome.** The first prize wheel resolved the winner from wherever the animation happened to stop. That is a fun spinner and a terrible system of record. Rewriting it so the draw persists first and the wheel animates toward a recorded result was a small change with a large consequence: the drawing became auditable, and a manager can prove after the fact who won and why.

**Agent rehearsals found less than I hoped.** I invested real time in agent-executable runbooks expecting them to surface product defects. They mostly proved the app already worked and surfaced gaps in my own evidence contract instead. Useful, but not the payoff I had planned. Knowing which techniques do not pay off is worth something, and it is the honest result.

**Working across two AI tools.** Core functionality was built in Codex. I also kept a reviewer in the loop to audit completion claims against the written spec line by line. That division caught real things and kept "it runs" from being mistaken for "it is done."

**I used all of it.** I went in on the Pro plan, took the $100 in Build Week credits, and spent every last one of them before the deadline. The agent rehearsals in particular are not cheap: driving a full manager workflow through MCP with screenshot evidence at every checkpoint burns real tokens. I would rather know exactly where the ceiling is than submit having left the tool half-explored.

### Accomplishments that I'm proud of

The zero-config promise holds. Clone it, seed it, run it, and every feature is demoable in under a minute with no key and no account.

The prize drawing is genuinely auditable. Immutable entry snapshot, recorded winner, visible drawing history, and an animation that reports the result instead of producing it.

The demo video is reproducible from the repository rather than hand-edited once and lost. The scene plan is a versioned artifact, and so is the prompt that generated the pipeline.

45 tests green, production build clean, everything committed.

### What I learned

Writing the specification before opening a Codex session changed the quality of what came out of it. So did having a completion definition that meant something specific: acceptance criteria met, tests green, build passing, work committed, docs current. "The code runs" is not a finish line.

The other lesson is that prompts are code. I lost a theme-generator prompt to a chat window mid-build and had to reconstruct it. Any prompt that generates part of the product now lives in the repo, versioned next to the schema it produces.

### What's next for SIM

Remote sales entry first: a simple phone panel for shift managers that feeds the live dashboard during service, so entry happens on the floor instead of at the back office computer.

After that, the list the rehearsals actually earned. Pre-finalization reconciliation so every tally is checked before a contest closes. Wheel provenance with visible odds, so servers can see exactly why they had the entries they had. Role-guarded lock and award controls, so a shift leader cannot trip a manager-only action.

---

## Built with

Comma-separated for the Devpost field:

```
next.js, react, typescript, tailwindcss, node.js, sqlite, better-sqlite3, vitest, playwright, ffmpeg, openai-api, gpt-5.6, codex, model-context-protocol, mcp
```

Notes if a longer form is wanted:

- **Languages:** TypeScript, JavaScript, SQL, CSS
- **Frameworks:** Next.js 15 (App Router), React 19, Tailwind CSS 4
- **Database:** SQLite via better-sqlite3, direct SQL, no ORM
- **APIs:** OpenAI Responses API (GPT-5.6) with strict JSON schema structured output
- **Agent tooling:** Two local Model Context Protocol servers, `sim_boh_pos` (synthetic POS feed) and `sim_ops` (role-aware operations with receipts and screenshot evidence), plus agent-executable JSON runbooks and a run verifier
- **Testing:** Vitest unit tests, Playwright capture automation
- **Media:** FFmpeg render pipeline driven by a versioned scene manifest
- **Built in:** Codex with GPT-5.6
- **Platform:** Local-first, runs on any machine with Node.js; no cloud services, no auth, no deployment

## Try it out links

```
https://github.com/estevanhernandez-stack-ed/sales-incentive-machine
```

One-click run, no install required (judges can open this directly):

```
https://codespaces.new/estevanhernandez-stack-ed/sales-incentive-machine
```

There is no hosted public instance by design; the app is local-first, writes to SQLite, and ships with a deterministic seed so every run starts from the same known state. The Codespaces link installs, seeds, and starts it automatically.

## Video

```
https://www.youtube.com/watch?v=XFfKLfKBDHE
```

## Image gallery — recommended order

Devpost shows the first image as the thumbnail.

| # | File | Why |
|---|---|---|
| 1 | `demo/out/title-card.png` | Title card, sets the frame |
| 2 | `artifacts/runbook-runs/20260718T152042Z-manager-item-contest-02fa54/screenshots/07-activated-dashboard.png` | The live dashboard, the core screen |
| 3 | `artifacts/runbook-runs/20260718T152042Z-manager-item-contest-02fa54/screenshots/02-contest-details.png` | Contest configuration |
| 4 | `artifacts/runbook-runs/20260718T152042Z-manager-item-contest-02fa54/screenshots/08-bingo-ready.png` | Server Bingo cards |
| 5 | `artifacts/runbook-runs/20260718T152042Z-manager-item-contest-02fa54/screenshots/08-gameboards-live.png` | Sales games in progress |
| 6 | `artifacts/runbook-runs/20260718T152042Z-manager-item-contest-02fa54/screenshots/13-contender-detail.png` | Wheel entries explained per server |
| 7 | `artifacts/runbook-runs/20260718T152042Z-manager-item-contest-02fa54/screenshots/14-prize-winner.png` | The recorded drawing result |
| 8 | `artifacts/runbook-runs/20260718T145233Z-shift-live-entry-83e577/screenshots/03-contest-tally-ready.png` | Shift-side entry during service |
| 9 | `demo/shots/09-future-features.png` | Roadmap card |

All screenshot paths are relative to the repository root.
