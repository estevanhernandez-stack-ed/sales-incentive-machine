# SIM operating runbooks

These human guides are generated from the same manifests used by the local operations API, agent prompts, run scaffolder, evidence verifier, and blind reviewer.

- [Contest Manager](./contest-manager.md)
- [Shift Manager](./shift-manager.md)
- [Local operations API and MCP](./operations-api.md)

## Commands

- `npm run runbook:docs` regenerates the human guides.
- `npm run runbook:scaffold -- --scenario shift-live-entry` creates a disposable run.
- `npm run runbook:serve -- --run <run-id> --port 3100` runs SIM against that copied database.
- `npm run runbook:verify -- --run <run-id>` checks evidence, receipts, observations, and debrief completion.

The governing contract is [the agent-executable runbook specification](../superpowers/specs/2026-07-17-agent-executable-runbooks.md).
