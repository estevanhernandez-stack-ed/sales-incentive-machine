# Sales Incentive Machine

SIM is a local-first restaurant sales-contest workspace. Managers configure goals and prizes, shift leaders enter live contest quantities and returned Bingo cards, and the team can present gameboards and one auditable prize drawing.

Built for OpenAI Build Week in Codex with GPT-5.6. [Watch the demo](https://www.youtube.com/watch?v=XFfKLfKBDHE).

All included restaurant, server, menu, check, and contest data is fictional.

## How Codex and GPT-5.6 built this

**Codex wrote the product.** Every feature in this repository was built in Codex sessions against a written specification (`docs/superpowers/specs/2026-07-13-sim-design.md`), which defined the data model, exact metric formulas, contest config shape, acceptance criteria, and an explicit cut list. Session IDs for each build thread are logged in [SUBMISSION.md](./SUBMISSION.md). The model was GPT-5.6 at high reasoning effort throughout.

**GPT-5.6 is also a runtime dependency.** The Contest Designer (`app/api/contest-designer/route.ts`) is the product's AI surface: a manager describes the contest they want in plain words, and GPT-5.6 returns a complete contest configuration through the Responses API using strict `json_schema` structured output. The response is then validated locally against real menu IDs and contest rules. A validation failure feeds the specific error back into a second attempt; if that also fails, or if no key is present, the app loads a versioned sample config instead of erroring. The AI writes the contest, but the app decides what is valid.

**Codex agents operated the app through MCP.** The repo ships two local Model Context Protocol servers so a Codex agent could drive the product the way a real operator would:

- `sim_boh_pos` records fully itemized fictional closed checks as a synthetic point-of-sale feed.
- `sim_ops` reads runbooks and current state, previews irreversible operations before committing them, executes role-aware idempotent operations, and returns receipts plus screenshot paths.

Paired with the agent-executable runbooks in `runbooks/`, this let Codex rehearse the full Contest Manager and Shift Manager workflows against a disposable copy of the database, then hand back a run package of reconciled receipts and screenshot evidence that `npm run runbook:verify` checks for completeness. Testing the app through its actual operator workflows, not only through unit tests.

**Codex built the demo pipeline too.** The submission video is reproducible from this repository: `demo/manifest.json` is the scene plan, `scripts/demo-video/capture.mjs` drives Playwright against the running app, and `scripts/demo-video/build.mjs` renders the master with FFmpeg. The prompt that specified that pipeline is versioned at `docs/prompts/demo-video.md`, next to the code it produced.

## Run it without installing anything

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/estevanhernandez-stack-ed/sales-incentive-machine)

Click the badge. The container installs dependencies, seeds the deterministic fictional database, starts the dev server, and opens SIM on the forwarded port 3000. No key, no account, no local setup.

If the preview does not open on its own, run `npm run dev` in the Codespace terminal and open the forwarded port. Setup is already done by then; the database is seeded during container creation.

There is no hosted public instance by design: SIM is local-first, writes to a SQLite file, and ships with a deterministic seed so every run starts from the same known state.

## Start locally

```powershell
npm install
npm run seed
npm run dev
```

Open `http://127.0.0.1:3000`. No environment variable or OpenAI key is required. When no key is configured, Contest setup uses the versioned fallback contest.

## Enable the live Contest Designer (optional)

Create `.env.local` in the repo root:

```
OPENAI_API_KEY=sk-...
```

With a key set, Contest setup sends the manager's plain-words goal to GPT-5.6 (override with `OPENAI_MODEL`) under a strict JSON schema, retries once on validation failure, and still falls back to the versioned sample config if both attempts miss. Without a key, every feature stays fully demoable.

## Demo video pipeline

The submission video is reproducible from the repo: `demo/manifest.json` is the scene plan, `node scripts/demo-video/capture.mjs demo/manifest.json` captures footage from the running app, and `node scripts/demo-video/build.mjs demo/manifest.json` renders the master (ffmpeg required on PATH). The prompt that specified the pipeline is versioned at `docs/prompts/demo-video.md`.

## Operating guides

- [Contest Manager runbook](./docs/runbooks/contest-manager.md)
- [Shift Manager runbook](./docs/runbooks/shift-manager.md)
- [Agent-executable runbook specification](./docs/superpowers/specs/2026-07-17-agent-executable-runbooks.md)
- [Local operations API and MCP guide](./docs/runbooks/operations-api.md)

The human guides, agent prompts, screenshot checklist, and verifier all use the canonical JSON manifests in `runbooks/`.

## Disposable discovery runs

```powershell
npm run runbook:scaffold -- --scenario shift-live-entry
npm run runbook:serve -- --run <run-id> --port 3100
npm run runbook:verify -- --run <run-id>
```

Each run receives a copy of `data/sim.db`; operating the run never changes the source database. Run artifacts live under the ignored `artifacts/runbook-runs/` directory.

Available scenarios are `manager-item-contest`, `manager-late-information`, `shift-live-entry`, and `shift-error-recovery`.

## Local agent tools

The project registers two separate optional MCP servers:

- `sim_boh_pos` records fully itemized fictional closed checks as a synthetic POS feed.
- `sim_ops` reads runbooks and current state, previews irreversible work, executes role-aware idempotent operations, and returns receipts plus screenshot paths.

Both are local STDIO processes. `sim_ops` only connects to an HTTP origin on `localhost`, `127.0.0.1`, or `::1`. Restart Codex after changing `.codex/config.toml` so the project MCP registrations reload.

## Verification

```powershell
npm test
npm run build
```
