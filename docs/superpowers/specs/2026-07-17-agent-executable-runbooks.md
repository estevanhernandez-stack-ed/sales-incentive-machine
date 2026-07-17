# SIM agent-executable runbooks specification

- **Date:** 2026-07-17
- **Status:** Approved for implementation
- **Scope:** Contest-manager and shift-manager operating runbooks, shared operation API, `sim_ops` MCP server, disposable run scaffolding, screenshot evidence, and product-discovery output
- **Authority:** This specification extends `2026-07-13-sim-design.md` and `2026-07-14-sales-data-workbench.md`. Where the older documents prescribe a detached inspector, raw-check-only item counts, or human-only operations, the newer approved behavior and this document win.

## 1. Product intent

SIM needs two operating runbooks:

1. A **Contest Manager** runbook for building a contest, setting its prize and scoring, activating it, preparing the floor materials, finalizing game awards, and drawing the winner.
2. A **Shift Manager** runbook for entering live contest quantities, logging returned Bingo cards, recording or correcting complete checks when appropriate, verifying the live boards, and handing off exceptions.

The runbooks are not only documentation. They are executable product-discovery instruments. A human, Codex, or another approved agent must be able to follow the same versioned procedure against a disposable SIM database, gather operation receipts, capture deterministic screenshots, and report new product needs.

An agent run is not successful merely because it reaches the expected final state. It must also reveal and record:

- missing capabilities;
- confusing language or navigation;
- excess data entry;
- unsafe or irreversible transitions;
- absent recovery paths;
- discrepancies between the UI and API;
- places where the runbook needed knowledge that SIM did not provide;
- evidence or screenshot failures.

## 2. Pinned design principles

### 2.1 One source for humans and agents

Each role has one canonical structured manifest. Human Markdown, API responses, operator prompts, screenshot checklists, and verification scripts derive from or reference that manifest. The same instruction must not be independently maintained in multiple prompts.

### 2.2 UI-first discovery

The primary operator agent performs user-visible work through the SIM UI. It may use the operations API or MCP to:

- discover identifiers and current state;
- create and select a disposable run;
- verify preconditions;
- obtain idempotent operation receipts;
- read back state after a UI action;
- recover from a tool interruption;
- execute an explicitly API-oriented contract scenario.

It may not use the API, direct SQL, or repository code to bypass an awkward UI step during a discovery run. If the UI prevents completion, the agent records a blocker or workaround instead of silently using a lower layer.

### 2.3 Operations are safe to retry

Every agent write has a caller-provided `operation_id`. Repeating the same operation ID with the same action and payload returns the original receipt without applying the write again. Reusing an operation ID with a different action or payload is rejected.

### 2.4 Stale context cannot mutate a new contest

Every contest-scoped write includes `expected_contest_id`. If it differs from the current active contest, the operation is rejected before any write.

### 2.5 Irreversible steps are explicit

Contest activation, final game awards, and prize drawing require `confirm: true`. Their read/preview steps remain separate from their write steps.

### 2.6 Screenshots prove UI state, not database state

The API returns evidence metadata but does not manufacture screenshots. The operator uses a browser to open the returned UI path, waits for the named visible text/state, and captures the checkpoint. A receipt and a screenshot are paired in the evidence manifest.

### 2.7 Runs do not modify product source

Operator and reviewer agents may write only inside their run artifact directory. They must not patch SIM, change the seed, edit prompts, alter specs, or repair the product during a run. Discoveries are triaged after the run.

### 2.8 Local-first and fake-only remain absolute

The feature adds no authentication, cloud service, model API dependency, deployment requirement, or real POS connection. Run scenarios and evidence use only seeded fictional restaurants, servers, menu items, and receipts.

## 3. Roles and authority

### 3.1 Contest Manager

The Contest Manager may:

- inspect the active contest and performance state;
- draft and preview a replacement contest;
- set contest name and prize;
- add, remove, and configure sales goals;
- configure wheel-entry rules;
- configure the featured sales race and goal board;
- activate a validated contest;
- review or print Bingo cards and gameboards;
- reconcile live inputs;
- finalize a sales race;
- award a completed goal board;
- preview the prize field;
- run one prize drawing;
- review receipts and evidence.

The Contest Manager may not:

- alter a saved wheel snapshot or winner;
- alter a locked game award;
- submit real employee, guest, or restaurant data;
- edit source code during an operating run.

### 3.2 Shift Manager

The Shift Manager may:

- inspect the active contest, prize, live goals, and boards;
- add item-count quantities for a server when that item is in the active contest;
- log a returned Bingo card;
- record a complete check when all check facts are known;
- inspect and correct a source check with a reason;
- verify that live standings changed;
- reconcile their operation receipts;
- record and hand off exceptions.

The Shift Manager may not:

- activate or replace a contest;
- change prize or scoring rules;
- lock a sales race;
- award a goal board;
- spin the prize wheel;
- create an offsetting negative tally;
- use a fabricated full check to represent a contest-only quantity;
- edit source code during a run.

Role is an operating boundary and audit field, not an authentication mechanism. Authentication remains out of scope.

## 4. Human runbook: Contest Manager

| Step | Action | Required result | Evidence |
|---|---|---|---|
| `CM-01` | Open Dashboard and identify the active contest, prize, goals, last winner, and time remaining. | The manager can state what is currently active before drafting a replacement. | Dashboard overview screenshot. |
| `CM-02` | Open Contest setup and enter the new contest name and prize. | Both fields show the intended values; the active contest is still unchanged. | Contest details screenshot. |
| `CM-03` | Configure every sales goal. For each goal choose metric, item/category when required, and either a fixed target or house comparison. | Every goal is valid and understandable without referring to source code. | Goals screenshot. |
| `CM-04` | Configure entries per goal and per Bingo daily win. | Wheel-entry rules match the intended incentive. | Scoring screenshot. |
| `CM-05` | Enable and configure the featured race and/or goal board. Set board names and award values. | The summary reports the correct number of goals and gameboards. | Game setup screenshot. |
| `CM-06` | Preview the proposed activation through the operations API. | Preview returns the current contest ID, normalized proposed config, affected boards, and no write receipt. | Preview JSON saved in evidence. |
| `CM-07` | Re-read the activation warning, confirm intentionally, and activate. | The old contest closes, one new contest becomes active, and fresh Bingo cards exist for every active server. | Activation receipt plus active Dashboard screenshot. |
| `CM-08` | Verify Dashboard, Bingo cards, Gameboards, Sales Data contest targets, and Prize Wheel prize/field. | All surfaces name the same active contest and prize. | One screenshot per required surface. |
| `CM-09` | Prepare floor materials. Re-randomize a Bingo card only before distribution; print cards and gameboards as needed. | Printed/distributed cards are the current cards. | Selected Bingo card and Gameboard screenshots. |
| `CM-10` | Before finalization, reconcile live contest tally receipts, Bingo submissions, and any source-check corrections. | No known late entry remains and no receipt is unresolved. | Operations reconciliation screenshot or JSON. |
| `CM-11` | Preview final race standings and goal-board eligibility. | Preview identifies winners, awards, and whether a drawing already exists. | Finalization preview evidence. |
| `CM-12` | Confirm and lock the sales race; confirm and award the goal board. | Awards are immutable and visible on Gameboards and Prize Wheel. | Award receipts and final Gameboards screenshot. |
| `CM-13` | Review every server in the Prize Wheel contender field and reconcile goal, Bingo, and game entries. | Entry totals are understood before drawing. | Expanded contender screenshot. |
| `CM-14` | Enter TV mode when presenting, confirm the draw, and spin once. | One persisted winner and immutable entry snapshot are created. | Draw receipt, winner screenshot, and Drawing history screenshot. |
| `CM-15` | Complete the run debrief. | Friction, missing needs, workarounds, and evidence gaps are recorded even when all steps passed. | Observation and summary artifacts. |

### Contest Manager stop conditions

Stop and request human direction when:

- the active contest changed after the draft or preview;
- the prize or goals shown on another surface do not match;
- Bingo has fewer cards than active servers;
- final standings do not reflect known receipts;
- a race or drawing is already final unexpectedly;
- the wheel has zero qualifying entries;
- an irreversible write lacks explicit confirmation;
- the only path forward requires direct SQL or source edits.

## 5. Human runbook: Shift Manager

| Step | Action | Required result | Evidence |
|---|---|---|---|
| `SM-01` | Open Dashboard and state the active contest, prize, and goals. | The shift is operating against the intended contest. | Dashboard screenshot. |
| `SM-02` | Open Sales Data and locate the server. Select `Add contest sales`. | The inline tool opens under that server and lists only active contest item-count targets. | Expanded server-row screenshot. |
| `SM-03` | Choose the contest item when more than one is available, enter quantity, and review the automatic count/value. | No party size, manual subtotal, or full-check item search is required. | Pre-submit tally screenshot. |
| `SM-04` | Submit the tally once and read the confirmation. | One append-only contest event is recorded; the server item count changes; check-based metrics do not. | Operation receipt and confirmation screenshot. |
| `SM-05` | Open Sales Games and verify the relevant server/board changed. | The visible board agrees with the read-back snapshot. | Updated Gameboard screenshot. |
| `SM-06` | When a physical Bingo card is returned, choose that server and mark only the completed squares. Click or drag along a row, column, or diagonal. | Off-line squares do not become part of the gesture; FREE counts automatically. | Marked card screenshot. |
| `SM-07` | Select `Log turned-in card`. | SIM reports lines, daily-win status, and wheel entries when the drawing remains open. | Submission receipt and confirmation screenshot. |
| `SM-08` | Use `Add full check` only when server, opened time, party size, all item lines, and the complete total are known. | Item lines calculate subtotal automatically and the saved source record reconciles. | Optional full-check screenshot and receipt. |
| `SM-09` | For an incorrect source check, open `Checks`, locate the check, edit it inline, and provide a correction reason. | The original value remains auditable and the corrected value is visible. | Correction screenshot and receipt when scenario requires it. |
| `SM-10` | Record exceptions. A mistaken contest tally is not offset with a negative quantity; it is documented as a recovery need. | The next manager receives a precise server, item, time, quantity, and receipt reference. | Observation record. |
| `SM-11` | Complete end-of-shift reconciliation and debrief. | All intended actions have receipts and all anomalies are handed off. | Shift summary artifact. |

### Shift Manager stop conditions

Stop and request direction when:

- the intended item is absent from `Add contest sales`;
- the active contest changed during entry;
- a submission reports a stale/re-randomized Bingo card;
- a contest tally was entered incorrectly and no correction workflow exists;
- the board fails to match a successful operation receipt;
- the action presented is Activate, Lock, Award, or Spin;
- completing a full check would require invented party, item, or subtotal data.

## 6. Canonical manifest contract

Canonical manifests live under `runbooks/` and validate against `runbooks/schema.json`.

Required top-level fields:

```json
{
  "schema_version": 1,
  "id": "contest-manager",
  "title": "Contest Manager Runbook",
  "role": "contest_manager",
  "purpose": "...",
  "authority": {
    "allowed": ["..."],
    "forbidden": ["..."]
  },
  "steps": []
}
```

Every step requires:

- `id`: stable step ID such as `CM-01`;
- `phase`: preflight, setup, live, finalize, evidence, or debrief;
- `title`;
- `instruction`;
- `mode`: `read`, `ui_write`, `api_write`, `decision`, or `debrief`;
- `preconditions`: observable requirements;
- `expected`: observable outcomes;
- `confirmation`: `none` or `explicit`;
- `allowed_tools`: semantic browser/API/MCP capabilities;
- `forbidden_shortcuts`;
- `evidence`: zero or more checkpoint records;
- `observations`: questions the operator must consider;
- `recovery`: safe recovery or stop instructions.

An evidence checkpoint requires:

```json
{
  "id": "SM-03-tally-ready",
  "required": true,
  "ui_path": "/data?server={server_id}&panel=contest",
  "wait_for": "Automatic total",
  "capture_name": "03-contest-tally-ready.png",
  "receipt_required": false
}
```

## 7. Tailored agent scaffolding

Each run-specific operator assignment is composed from:

1. `agents/runbooks/base-operator.md` — universal safety, UI-first, evidence, and no-source-edit rules.
2. A role overlay:
   - `agents/runbooks/contest-manager-operator.md`
   - `agents/runbooks/shift-manager-operator.md`
3. One scenario JSON from `runbooks/scenarios/`.
4. The canonical role manifest.
5. Run metadata: run ID, disposable database path, base URL, artifact directory, and timestamps.

The scaffolded operator prompt must state:

- its assigned role and scenario;
- the exact allowed state-changing actions;
- that UI-first behavior is mandatory;
- that API/MCP may not hide UI friction;
- where artifacts may be written;
- that product source is read-only for the duration of the run;
- that irreversible actions require confirmation;
- that the agent must record observations even on a passing step;
- that it must not fix discoveries during the run.

### 7.1 Blind reviewer

`agents/runbooks/blind-reviewer.md` defines a read-only second pass. The reviewer receives only:

- canonical runbook;
- scenario;
- operator transcript or structured step log;
- operation receipts;
- screenshots/evidence manifest;
- observations and final summary.

It does not receive source code or the operator's private reasoning. It independently classifies missed needs, unsupported conclusions, evidence gaps, and runbook ambiguity.

## 8. Discovery artifacts

Each run directory contains:

```text
artifacts/runbook-runs/<run-id>/
  RUN.md
  OPERATOR_PROMPT.md
  run.json
  sim.db
  evidence.json
  observations.json
  operations.json
  summary.json
  review.json
  screenshots/
```

`observations.json` entries require:

- `observation_id`;
- `step_id`;
- `category`: `missing_capability`, `navigation`, `copy`, `excess_input`, `unsafe_transition`, `recovery`, `data_mismatch`, `api_gap`, `runbook_gap`, or `evidence_gap`;
- `expected`;
- `observed`;
- `workaround` or null;
- `impact`: low, medium, high, or blocker;
- `evidence_ids`;
- `operation_ids`;
- `suggested_need`;
- `confidence`;
- `status`: `candidate`, `accepted`, `rejected`, or `deferred`.

The run may propose needs but may not mark them accepted. Acceptance is a human triage action.

## 9. Shared operation architecture

All agent and UI actions ultimately call domain functions. The operations layer adds stale-state checks, idempotency, role checks, confirmation checks, receipts, and evidence metadata.

```text
UI route ───────────────┐
                       ├─> domain action ─> SQLite
Agent HTTP ops route ─> operations envelope ─┘
sim_ops MCP ───────────> Agent HTTP ops route
```

`sim_boh_pos` remains a separate synthetic POS feed. It is not expanded into contest administration.

## 10. Operation receipts and data model

Add:

```sql
CREATE TABLE operation_receipts (
  operation_id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  expected_contest_id INTEGER,
  request_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('applied', 'already_applied')),
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

The persisted row represents the first successful application. `already_applied` is returned at read time for a matching retry; the stored original receipt is not rewritten.

Write envelope:

```json
{
  "operation_id": "sm-live-001-add-avery-corn",
  "actor_role": "shift_manager",
  "expected_contest_id": 3,
  "confirm": false,
  "payload": {}
}
```

Write response:

```json
{
  "ok": true,
  "operation": {
    "operation_id": "sm-live-001-add-avery-corn",
    "action": "record_contest_sales",
    "status": "applied",
    "contest_id": 3,
    "created_at": "2026-07-17T20:00:00.000Z"
  },
  "result": {},
  "evidence": {
    "ui_path": "/data?server=1&panel=contest",
    "wait_for": "Added 4 Ember Corn Cups sales",
    "checkpoint_id": "SM-04-tally-confirmed"
  }
}
```

### 10.1 Hashing and retries

- Request hashes use a deterministic canonical JSON representation of action, role, expected contest, confirmation, and payload.
- Object keys are sorted recursively.
- A matching retry returns the original result and `status: already_applied`.
- A mismatched retry returns HTTP 409 / MCP tool error.
- Failed validation or failed transactions do not create receipts.
- The receipt insert and the domain write occur in the same SQLite transaction.

## 11. Role-aware operations

Initial operation actions:

| Action | Roles | Confirmation | Result |
|---|---|---|---|
| `record_contest_sales` | Shift, Contest | No | Appended tally and updated scoped item count. |
| `record_bingo_submission` | Shift, Contest | No | Lines, daily win, wheel entries, duplicate status. |
| `record_full_check` | Shift, Contest | No | Complete itemized check with subtotal derived from item lines. |
| `correct_source_check` | Shift, Contest | No | Audited source-check correction with subtotal derived from item lines. |
| `activate_contest` | Contest | Yes | New contest ID and fresh card count. |
| `finalize_sales_race` | Contest | Yes | Final places and entries. |
| `award_goal_board` | Contest | Yes | Eligible servers and entries. |
| `draw_prize_winner` | Contest | Yes | Winner and immutable entry snapshot. |

Read operations:

- `get_runbook(role)`;
- `get_ops_snapshot()`;
- `get_operation_receipt(operation_id)`;
- `preview_contest(config)`;
- `preview_game_finalization(game_id)`;
- `preview_prize_drawing()`;
- `list_recent_operations(limit, role?)`.

## 12. HTTP API

The agent API is local JSON under `/api/ops`:

| Method and path | Purpose |
|---|---|
| `GET /api/ops/runbooks/[role]` | Return canonical role manifest. |
| `GET /api/ops/snapshot` | Return active contest, servers, targets, games, Bingo status, wheel status, and next-action safety flags. |
| `GET /api/ops/operations/[operationId]` | Reconcile one receipt. |
| `GET /api/ops/operations?limit=20&role=shift_manager` | List recent receipts. |
| `POST /api/ops/preview/contest` | Validate and normalize a proposed contest without writing. |
| `POST /api/ops/preview/game` | Preview standings/awards without finalizing. |
| `POST /api/ops/preview/wheel` | Preview contender entries without drawing. |
| `POST /api/ops/commands` | Execute one typed, idempotent write envelope. |

Errors use `{ "ok": false, "error": { "code": "...", "message": "...", "details": {} } }` with stable codes including:

- `INVALID_REQUEST` — 400;
- `ROLE_NOT_ALLOWED` — 403;
- `NOT_FOUND` — 404;
- `OPERATION_CONFLICT` — 409;
- `STALE_CONTEST` — 409;
- `CONFIRMATION_REQUIRED` — 409;
- `STATE_ALREADY_FINAL` — 409;
- `NO_QUALIFYING_ENTRIES` — 422.

## 13. `sim_ops` MCP server

Register a second project-scoped STDIO server:

```toml
[mcp_servers.sim_ops]
command = "node"
args = ["mcp/sim-ops-server.mjs"]
cwd = "."
enabled = true
required = false
default_tools_approval_mode = "writes"
startup_timeout_sec = 10
tool_timeout_sec = 30
```

The MCP server is an HTTP client for the local operations API. It does not duplicate database logic. It accepts an optional `base_url`, restricted to loopback HTTP addresses, so a disposable run can use a different local port.

Tools:

- `get_runbook`;
- `get_ops_snapshot`;
- `get_operation_receipt`;
- `list_recent_operations`;
- `preview_contest`;
- `preview_game_finalization`;
- `preview_prize_drawing`;
- `record_contest_sales`;
- `record_bingo_submission`;
- `record_full_check`;
- `correct_source_check`;
- `activate_contest`;
- `finalize_sales_race`;
- `award_goal_board`;
- `draw_prize_winner`.

Read tools are annotated read-only. Every write tool is approval-gated and carries role, confirmation, stale-contest, and idempotency fields.

## 14. Deterministic UI evidence states

Supported deep links:

- `/data?server={server_id}&panel=contest` — open the inline contest tally for a server;
- `/data?server={server_id}&panel=checks` — open that server's check drawer;
- `/data?check={check_id}&panel=edit` — open a check editor when present on the current result page;
- `/bingo?server={server_id}` — select a server's current Bingo card;
- `/games?game={game_id}` — identify and scroll to a gameboard;
- `/wheel?server={server_id}` — expand one contender;
- `/contest` and `/` — stable setup and Dashboard views.

Deep links alter presentation state only. They never write data.

Every required screenshot record contains:

- checkpoint ID;
- step ID;
- capture timestamp;
- UI path;
- expected visible text;
- actual screenshot path or external capture reference;
- associated operation IDs;
- result: pass, fail, blocked, or skipped;
- operator note.

## 15. Disposable run harness

The harness has no model dependency.

### 15.1 Scaffold

`npm run runbook:scaffold -- --scenario <scenario-id>`:

1. validates the scenario and role manifest;
2. creates a unique run ID unless supplied;
3. copies `data/sim.db` to the run directory;
4. writes run metadata;
5. composes the operator prompt from base, role, scenario, and manifest references;
6. initializes evidence, observation, operation, summary, and review artifacts;
7. prints the exact serve and verification commands.

### 15.2 Serve

`npm run runbook:serve -- --run <run-id> --port 3100` starts SIM with:

- `SIM_DATABASE_PATH` set to the run database;
- the requested loopback port;
- no mutation of `data/sim.db`.

### 15.3 Verify

`npm run runbook:verify -- --run <run-id>` validates:

- required artifact shapes;
- required checkpoint completion;
- referenced screenshot files when local paths are used;
- operation receipt reconciliation;
- debrief completion;
- no accepted discoveries without human triage metadata.

## 16. Initial scenarios

### 16.1 `manager-item-contest`

- Create a new item-sales contest around a fictional menu item.
- Set a named prize.
- Add at least one fixed item-count goal.
- Configure goal/Bingo wheel entries.
- Enable the featured sales race and goal board.
- Activate, verify all surfaces, finalize awards, preview the wheel, and draw.

### 16.2 `shift-live-entry`

- Confirm active contest.
- Record different active-contest quantities for three fictional servers.
- Verify the item-count column and Sales Gameboard after each receipt.
- Log one winning Bingo card.
- Complete shift reconciliation.

### 16.3 `shift-error-recovery`

- Record an intentionally incorrect positive contest quantity.
- Attempt recovery only through documented UI and tools.
- Do not insert a negative offset or alter SQL.
- Record the resulting missing-capability or available recovery path as evidence.

### 16.4 `manager-late-information`

- Reach finalization preview.
- Introduce a late, valid shift receipt before confirmation.
- Verify the preview becomes stale or visibly changes.
- Confirm only after reconciliation.

## 17. Testing strategy

### 17.1 Unit tests

- canonical JSON and request hashing;
- operation ID validation;
- role authorization;
- confirmation enforcement;
- active-contest preconditions;
- same-payload retry behavior;
- different-payload conflict behavior;
- receipt/domain-write atomicity;
- manifest validation;
- scaffold artifact generation;
- loopback-only MCP base URL validation.

### 17.2 Contract tests

- every MCP tool maps to the intended HTTP method and path;
- every write tool exposes approval annotations;
- HTTP error codes and envelopes are stable;
- API and MCP return evidence metadata;
- existing UI endpoints and new ops endpoints produce the same domain state.

### 17.3 Disposable replay tests

- scaffold does not modify the source database;
- run server uses the copied database;
- manager scenario can reach one active replacement contest and one drawing;
- shift scenario can add quantities and Bingo without manager authority;
- retrying recorded operations creates no duplicate rows;
- deep links render expected text;
- run verification rejects missing evidence.

## 18. Definition of done

This feature is complete only when:

- this spec and both canonical manifests agree;
- generated/human runbooks are current;
- tailored operator and reviewer prompts are versioned;
- shared operations and receipts are implemented and tested;
- the HTTP ops API is documented and tested;
- `sim_ops` is registered, documented, and protocol-tested;
- all listed deep links work without writing data;
- the scaffold/serve/verify harness works on Windows PowerShell 7;
- at least one disposable manager rehearsal and one disposable shift rehearsal produce valid artifact packages;
- `npm test` passes;
- `npm run build` passes;
- the ordinary `npm install && npm run seed && npm run dev` path remains unchanged;
- no secrets or real data are introduced;
- work is committed with conventional commits.

## 19. Explicit non-goals

- No employee authentication or role enforcement beyond operation contracts.
- No cloud agent hosting or embedded model call.
- No automatic product fixes during a run.
- No automatic acceptance of agent suggestions.
- No production POS connection.
- No screenshot OCR as a source of record.
- No arbitrary remote MCP `base_url`.
- No source-database mutation during disposable rehearsals.
