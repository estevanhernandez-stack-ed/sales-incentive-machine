# SIM local operations API and MCP

The operations boundary lets approved humans and agents run the same manager workflows with stale-state protection, role limits, explicit confirmation, and idempotent receipts. It remains local-only and adds no authentication or production POS connection.

## Safe-write envelope

Every write posts to `POST /api/ops/commands`:

```json
{
  "operation_id": "shift-20260717-avery-corn-01",
  "action": "record_contest_sales",
  "actor_role": "shift_manager",
  "expected_contest_id": 1,
  "confirm": false,
  "payload": {
    "serverId": 1,
    "menuItemId": 1,
    "quantity": 4
  }
}
```

- `operation_id` identifies one exact intent. Retry the same intent with the same ID.
- Reusing an ID with different intent returns `OPERATION_CONFLICT` and writes nothing.
- `expected_contest_id` must still be active or the API returns `STALE_CONTEST`.
- Activation, final awards, and drawing require `contest_manager` plus `confirm: true`.
- A successful response includes the persisted result, receipt metadata, and a deterministic UI evidence checkpoint.

Full-check operations accept item lines and derive subtotal; callers do not submit the subtotal twice.

## Reads and previews

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/ops/runbooks/contest_manager` | Canonical role manifest. |
| GET | `/api/ops/snapshot` | Active contest/config, servers, targets, current Bingo card IDs, games, wheel, safety flags, recent receipts. |
| GET | `/api/ops/operations?limit=20&role=shift_manager` | Recent receipts. |
| GET | `/api/ops/operations/{operationId}` | One receipt for retry reconciliation. |
| POST | `/api/ops/preview/contest` | Validate and normalize a draft without writing. |
| POST | `/api/ops/preview/game` | Preview final awards without locking. |
| POST | `/api/ops/preview/wheel` | Preview contender entries without drawing. |

Preview responses always include `write_performed: false`.

## Write actions

| Action | Shift Manager | Contest Manager | Confirmation |
|---|---:|---:|---:|
| `record_contest_sales` | Yes | Yes | No |
| `record_bingo_submission` | Yes | Yes | No |
| `record_full_check` | Yes | Yes | No |
| `correct_source_check` | Yes | Yes | No |
| `activate_contest` | No | Yes | Yes |
| `finalize_sales_race` | No | Yes | Yes |
| `award_goal_board` | No | Yes | Yes |
| `draw_prize_winner` | No | Yes | Yes |

## Stable error contract

Errors use:

```json
{
  "ok": false,
  "error": {
    "code": "STALE_CONTEST",
    "message": "The active contest changed before this operation",
    "details": {
      "expected_contest_id": 1,
      "active_contest_id": 2
    }
  }
}
```

Stable codes are `INVALID_REQUEST`, `ROLE_NOT_ALLOWED`, `NOT_FOUND`, `OPERATION_CONFLICT`, `STALE_CONTEST`, `CONFIRMATION_REQUIRED`, `STATE_ALREADY_FINAL`, and `NO_QUALIFYING_ENTRIES`.

## `sim_ops` MCP

The project registration is in `.codex/config.toml`. Start the server directly for protocol inspection with:

```powershell
npm run mcp:ops
```

The MCP tools mirror the API. An optional `base_url` selects a disposable run, for example `http://127.0.0.1:3100`; non-loopback, HTTPS, credential-bearing, path-bearing, query-bearing, and fragment-bearing URLs are rejected.

During a discovery run, the operator must still use the visible UI first. MCP is for state discovery, previews, receipts, read-back, interruption recovery, and explicitly API-oriented contract checks—not for hiding a missing or awkward UI workflow.

If an external browser or evidence system blocks the run, use `npm run runbook:block -- --run <run-id> --reason "..." --url http://127.0.0.1:3100` to reconcile existing receipts and produce an explicitly blocked package. This does not convert missing screenshots into passing evidence; it records the blocker for a later rerun.
