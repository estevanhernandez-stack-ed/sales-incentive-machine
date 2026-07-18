# Sales Incentive Machine

SIM is a local-first restaurant sales-contest workspace. Managers configure goals and prizes, shift leaders enter live contest quantities and returned Bingo cards, and the team can present gameboards and one auditable prize drawing.

Built for OpenAI Build Week in Codex with GPT-5.6. [Watch the demo](https://www.youtube.com/watch?v=XFfKLfKBDHE).

All included restaurant, server, menu, check, and contest data is fictional.

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
