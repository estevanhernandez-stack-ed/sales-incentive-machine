# Synthetic BOH POS MCP server

SIM includes a local MCP server that lets Codex-compatible agents act like a fictional back-of-house POS feed. It writes only to the local demo database and must never receive real restaurant, employee, or guest information.

## Tool workflow

1. Call `get_pos_catalog` to discover the active fake servers and menu item IDs.
2. Compose fictional, fully itemized checks using those IDs.
3. Use `record_closed_check` for one receipt or `record_shift` for an atomic batch.
4. Reuse the same `external_reference` when retrying. Duplicate references return the original check rather than inserting twice.
5. Call `get_recent_pos_receipts` to reconcile what the MCP server accepted.

SIM derives every line price and check subtotal from its seeded menu. Agents cannot supply arbitrary prices or stored metric results. Writes appear as imported, itemized synthetic BOH POS records, so the dashboard, games, and wheel recompute from raw sales normally.

## Local setup

The project-scoped [`.codex/config.toml`](../.codex/config.toml) registers the `sim_boh_pos` STDIO server. Trust the project, run `npm install && npm run seed`, then restart Codex so it reloads MCP configuration. Use `/mcp` to confirm the server is connected.

To inspect the protocol server manually:

```powershell
npm run mcp:boh-pos
```

The process intentionally waits for newline-delimited MCP JSON-RPC messages on standard input and writes no human-readable text to standard output.

## Tools

- `get_pos_catalog` — read-only fake server/menu discovery.
- `record_closed_check` — idempotently insert one fictional closed check.
- `record_shift` — atomically insert 1–100 fictional closed checks.
- `get_recent_pos_receipts` — read-only reconciliation of MCP-originated checks.

Write tools are marked for approval in the project MCP configuration. The server has no network listener, credentials, or connection to a real POS system.
