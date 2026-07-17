# Sales Incentive Machine

SIM is a local-first restaurant sales-contest workspace. Managers configure goals and prizes, shift leaders enter live contest quantities and returned Bingo cards, and the team can present gameboards and one auditable prize drawing.

All included restaurant, server, menu, check, and contest data is fictional.

## Start locally

```powershell
npm install
npm run seed
npm run dev
```

Open `http://127.0.0.1:3000`. No environment variable or OpenAI key is required. When no key is configured, Contest setup uses the versioned fallback contest.

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
