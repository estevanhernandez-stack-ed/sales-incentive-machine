# SIM: Sales Data Workbench — implementation specification

**Status:** Ready to build
**Owner:** Restaurant manager / sales-contest operator
**Scope:** `/data`, raw-sales query services, and the import/correction APIs that feed it
**Relationship to the primary brief:** This supplements `2026-07-13-sim-design.md`. If they conflict, the primary brief wins.

## 1. Outcome

Turn `/data` into a calm, trustworthy **Sales Data Workbench**. A manager must be able to answer four questions without opening a spreadsheet:

1. What sales records are in SIM for the shift or contest week?
2. Is there enough item detail for the active contests to be fair?
3. What was on a specific check, where did it come from, and what changed?
4. Can I safely import, add, or correct a record before it affects a live board?

This is not a POS integration. It remains a local CSV and manual-entry tool that works with no account, API key, or network connection.

## 2. Product principles

- **Guide at the decision point.** Show reconciliation, data coverage, and consequences beside the action that needs them; do not add promotional cards or generic encouragement.
- **A record is inspectable before it is editable.** Viewing a check never implies changing it.
- **Source events are the truth.** Check-based metrics come from raw checks and items. Active item-count contests may also consume append-only contest tally events that never masquerade as checks. No final metric values are persisted.
- **History explains, not obscures.** A correction never destroys its origin or its prior value.
- **No silent fairness changes.** A correction can update live, unlocked standings, but locked game awards and wheel snapshots remain immutable historical outcomes.
- **Fast under service pressure.** The common paths—find a check, inspect it, fix one item, add a missed check—should be usable with one focused panel and minimal page movement.

## 3. In scope and explicitly out of scope

### In scope

- A filterable, paginated check browser with check IDs and item detail.
- A desktop inspector / mobile drawer for view, correction, and audit history.
- Item-first manual entry and correction with live reconciliation.
- A server-row quick tally for item-count targets in the active contest, with automatic quantity/value math and an audit trail separate from checks.
- A data-health strip that explains item-data coverage and affected active metrics/games.
- A two-stage CSV preflight and confirmed import workflow, including column mapping and check-level validation.
- Durable source/check references so re-imports can identify new, changed, and already-present checks.
- An impact preview before a correction is saved.

### Out of scope

- Connecting to, polling, or authenticating with a POS system.
- Multi-restaurant support, staff login, approval workflows, or notifications.
- Automatically changing a locked game award, historical wheel draw, or its saved entry snapshot.
- Redefining the contest metric time window. The workbench must use the same metric scope as the dashboard until a separate scoped-metrics specification is approved.
- AI-assisted data cleanup. The import flow must be deterministic and explain its decisions.

## 4. Information architecture and interaction design

### 4.1 Page layout

`/data` is a workbench in this order:

1. **Context bar** — current view label (All sales / Contest week / custom date), record count, and the active contest name when applicable.
2. **Data health strip** — itemization coverage and the next corrective action, described in section 5.
3. **Action row** — `Import CSV`, `Add check`, and `Export CSV`. These are tasks, not marketing cards.
4. **Filter toolbar** — date preset, custom date range, server, source, item-detail state, needs-attention state, and text search.
5. **Check browser** — 25 checks per page by default, with View and Edit as distinct actions.
6. **Inline tools** — View, Edit, Add check, contest tally, and server check history unfold directly beneath the row or action that launched them.

The default date preset is **Contest week** when an active contest exists; otherwise it is **All sales**. The manager can always select Today, Yesterday, Contest week, or Custom. This affects the data browser and health strip only, not the underlying contest metric semantics.

### 4.2 Check browser

Columns, in order:

| Column | Purpose |
|---|---|
| Check # | Internal ID, plus the external check reference when available. This makes disputes searchable. |
| Opened | Local date/time of the sale. |
| Server | Assigned server. |
| Party | Party size. |
| Total | Check subtotal. |
| Item detail | `Complete`, `Check-only`, or `Needs review`; never just an unexplained item-row count. |
| Source | Seed, import batch, manual, or corrected. |
| Changed | Most recent correction time/reason summary, if any. |
| Actions | `View` and `Edit` buttons. |

Text search matches internal check ID, external reference, server name, item name, import filename/source label, and correction note. It works with every filter and searches the full database, not only the current page.

Pagination is server-backed and preserves all filters/search terms. The footer reports `Showing 26–50 of 2,461 checks`, not merely a page number.

### 4.3 Check inspector

The inspector has three modes.

The inspector is row-anchored: opening or editing a check inserts it directly beneath that check. Server-level check history and contest tally tools similarly expand beneath the selected server row.

### 4.4 Active contest tally

For every active `item_count` goal or game, each server row exposes `Add contest sales`. The tool lists only the active contest items, defaults to its first target, and asks only for quantity. It calculates menu value automatically and appends a `contest_score_entries` event. This event contributes to that contest's item-count standings and audit history, but never creates a check or changes PPA, average check, party size, alcohol percentage, or attachment rate.

#### View

- Identity: internal check ID, external reference (if any), origin, import batch, and created time.
- Sale: server, opened time, party size, subtotal.
- Items: menu item, quantity, price each, extended price, and item total.
- Status: itemized / check-only and a short note explaining metric eligibility.
- History timeline: origin followed by each correction, with time, reason, changed fields, and before/after item lines.
- Primary action: `Edit check`.

#### Edit

- Starts with current values and item lines.
- A required `Reason for correction` appears before Save.
- Edits use an **itemized** or **check-total-only** mode:
  - *Itemized* is the default. The subtotal is calculated from line items and can be overridden only by an explicit `Set subtotal to items total` action.
  - *Check-total-only* requires a reason and carries the visible label `Excluded from item-based metrics`.
- The editor shows `Items total`, `Check subtotal`, and `Difference` live. Save is disabled while a non-zero difference remains.
- The save area includes a compact impact preview when the change affects the active contest, described in section 8.

#### Add check

- Uses the same editor, initially itemized and empty.
- Server, opened time, party size, and first item are keyboard-reachable in that order.
- The record is saved as `manual` origin. A check-total-only entry is allowed only with a note and is visibly excluded from item-based metrics.

## 5. Data health and contest fairness

The health strip is a query result for the currently selected browser date range. It does not persist a health score.

It shows:

- `Checks`: count in scope.
- `Itemized`: count and percentage whose item detail can participate in item-based metrics.
- `Check-only`: count excluded from alcohol percentage and attachment-rate denominators.
- `Needs attention`: incomplete/reconciliation-failed records from an import preflight, if any.
- `Active contest effect`: the specific goal/game metrics that rely on itemized checks, for example: `Dessert attach and Ember Rush need item detail.`

The primary link is `Review check-only records`, which applies the `Check-only` filter. The copy must be factual: “16 checks lack item detail; dessert attachment excludes them.” It must not imply that the metric is broken or that the manager has failed.

Definition: an itemized check is one that matches the existing metric-query rule—an audit record with `is_itemized = 0` is excluded; seeded checks without an audit row are treated as itemized when they contain item rows. This keeps the health strip consistent with the metric layer.

## 6. Import workflow: preflight, then confirm

### 6.1 Step 1: Upload and map

The manager selects a local CSV. No file leaves the machine.

The preflight screen:

- Detects headers and displays the first ten parsed rows.
- Maps CSV columns to SIM fields. Required mappings are check reference, opened time, server, party size, and subtotal. Item name, quantity, price, and note are optional as a group.
- Offers reasonable aliases (for example `check #`, `employee`, `covers`, `net sales`) but always shows the final mapping.
- Requires the manager to confirm the timezone used by the file. The default is the browser’s local timezone.
- Lets the manager map unknown server names to an existing active SIM server for this batch. It never creates a server silently.

### 6.2 Step 2: Validate and review

Preflight groups rows by check reference and reports the number of **checks**, not just CSV lines:

- Ready to import.
- Check-only records.
- Unknown/unmapped servers.
- Invalid timestamp, party, quantity, or price rows.
- Itemized checks whose item total does not equal subtotal.
- Duplicate references, separated into `Already present`, `Changed`, and `New`.

A malformed item row invalidates its whole check; the manager may explicitly exclude that check with a visible reason. Preflight never silently drops a row.

Itemized imports must be fully itemized: all grouped rows carry an item or none do, and the extended item total equals the check subtotal to the nearest cent. Check-only imports remain valid but carry their metric-eligibility warning.

### 6.3 Step 3: Confirm import

The final button reads `Import 1,204 ready checks`; it is disabled until all validation errors are resolved or explicitly excluded. Confirm sends the CSV, accepted column mapping, timezone, server mappings, and explicit exclusion list in one request. The server repeats validation and writes the accepted checks in one SQLite transaction.

An exact-file content hash is still rejected as a duplicate. A revised file is reconciled by durable external check identity:

- **New:** create the check.
- **Already present:** do not duplicate it; display it as skipped.
- **Changed:** show the old/new values and let the manager either skip it or apply it as a named correction. It must not overwrite automatically.

Import history records the file/source label, time, checks accepted/skipped/excluded, itemized coverage, and a link that reapplies its filters in the browser.

## 7. Data model and query contracts

The existing schema is reset deterministically by `npm run seed`; schema changes for this workbench are therefore made in `lib/db/schema.sql` and seed data, not through a cloud migration system.

### 7.1 Preserve origin separately from current status

`sales_entry_audit.source_type` currently changes to `corrected`, which loses the original import/manual/seed provenance. Replace that responsibility with immutable origin and change records:

```sql
CREATE TABLE check_origins (
  check_id INTEGER PRIMARY KEY REFERENCES checks(id) ON DELETE CASCADE,
  origin_type TEXT NOT NULL CHECK(origin_type IN ('seed', 'import', 'manual')),
  data_import_id INTEGER REFERENCES data_imports(id),
  source_label TEXT NOT NULL DEFAULT '',
  external_reference TEXT,
  business_date TEXT,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX check_origin_external_ref_idx
  ON check_origins(source_label, business_date, external_reference)
  WHERE external_reference IS NOT NULL;

CREATE TABLE sales_change_log (
  id INTEGER PRIMARY KEY,
  check_id INTEGER NOT NULL REFERENCES checks(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK(action_type IN ('correction', 'import_revision', 'revert')),
  changed_at TEXT NOT NULL,
  reason TEXT NOT NULL,
  before_json TEXT NOT NULL,
  after_json TEXT NOT NULL
);
CREATE INDEX sales_change_log_check_changed_idx ON sales_change_log(check_id, changed_at DESC);
```

`source_label` is a manager-supplied CSV source name (or a deterministic local default), not a credential or external POS connection. `business_date` and `external_reference` together make a POS check reference durable enough for daily imports without introducing multi-restaurant data.

`sales_entry_audit` may remain as a compact current-state/metric-eligibility table for compatibility, but `source_type` must no longer be used as the original source of a corrected record. The dashboard’s Edited badge derives from `EXISTS(sales_change_log)` or a manual origin, not from overwriting origin.

The existing `sales_corrections` data is superseded by `sales_change_log`. A seeded database starts with the new table; a future migration, if needed, copies `before_json` entries as correction events with an empty/derived after snapshot.

### 7.2 Extend import history

`data_imports` gains fields sufficient for the history ledger:

```sql
ALTER TABLE data_imports ADD COLUMN source_label TEXT NOT NULL DEFAULT '';
ALTER TABLE data_imports ADD COLUMN accepted_checks INTEGER NOT NULL DEFAULT 0;
ALTER TABLE data_imports ADD COLUMN skipped_checks INTEGER NOT NULL DEFAULT 0;
ALTER TABLE data_imports ADD COLUMN excluded_checks INTEGER NOT NULL DEFAULT 0;
ALTER TABLE data_imports ADD COLUMN itemized_checks INTEGER NOT NULL DEFAULT 0;
```

For fresh seed creation these are defined directly in the table. `row_count` remains the physical CSV-line count for traceability; the UI labels check counts separately.

### 7.3 Service/query functions

Keep all SQL in `lib/db/` and return typed objects. Suggested boundaries:

```ts
type SalesFilter = {
  datePreset?: 'today' | 'yesterday' | 'contest_week' | 'custom' | 'all';
  start?: string;
  end?: string;
  serverId?: number;
  source?: 'seed' | 'import' | 'manual';
  itemDetail?: 'itemized' | 'check_only' | 'needs_attention';
  query?: string;
  page?: number;
};

getSalesWorkbench(db, filter): SalesWorkbenchData;
getCheckDetail(db, checkId): CheckDetail;
getSalesDataHealth(db, filter): SalesDataHealth;
previewSalesImport(db, csv, mapping): ImportPreflight;
confirmSalesImport(db, request): ImportResult;
previewCorrectionImpact(db, draft): CorrectionImpact;
createManualCheck(db, draft): number;
correctSalesCheck(db, draft): number;
revertSalesChange(db, changeId, reason): number;
```

`getSalesWorkbench` performs paginated browser queries and returns health in the same filter scope. `getCheckDetail` returns origin, current values/items, and ordered change history. All correction/create/revert writes are transactions.

Metric functions retain their existing exact formulas and remain the only way leaderboard/game metric values are computed. The workbench may call them for an impact preview but never writes their results into a table.

### 7.4 API boundaries

Use small request handlers over the shared services:

| Route | Responsibility |
|---|---|
| `POST /api/sales-data/import/preflight` | Parse/map/validate only; no database write. |
| `POST /api/sales-data/import` | Revalidate and atomically confirm accepted records. |
| `GET /api/sales-data/checks/[checkId]` | Return detail for the inspector. |
| `PUT /api/sales-data/checks/[checkId]` | Save named correction and change log. |
| `POST /api/sales-data/checks/[checkId]/impact` | Return a non-persisted impact preview for a draft. |
| `POST /api/sales-data/manual` | Create a manual check from the shared draft validator. |
| `POST /api/sales-data/contest-score` | Append an item-count tally for a server and an item referenced by the active contest. |
| `POST /api/sales-data/changes/[changeId]/revert` | Revert an earlier state as a new auditable event. |

Every write revalidates `/`, `/data`, `/games`, and `/wheel`. The API must not accept a manager-supplied metric result, game placement, or wheel entry count.

## 8. Live-contest and historical-outcome behavior

Before a correction is saved, the inspector asks the shared query layer for impact using the exact current dashboard/game metric scope. The preview is concise:

- `Live leaderboard: Avery moves from 4th to 2nd in Dessert Attach.`
- `Sweet Finish: now qualifies.`
- `No current game or contest result changes.`

If a Sales Race is already locked, or a wheel drawing exists, the preview also says:

> This correction updates raw sales and future live queries. Locked race awards and the saved wheel-drawing entry snapshot do not change.

Corrections remain allowed after a lock/drawing because data accuracy matters. They are labeled `Post-lock adjustment` in the change timeline. The app never changes `game_awards` or `wheel_drawings.entries_snapshot_json` as a side effect of a correction.

## 9. Plain-language copy rules

- Use `Item detail is complete` / `Check-only: excluded from item-based metrics`, never vague labels such as `0 rows`.
- Use `Review changes` and `View check` before `Edit check`.
- Use `Save corrected check` only after a reason is present.
- Explain a rejected import with the affected check reference and a direct remedy.
- Do not say “sync,” “integration,” “AI cleanup,” or imply live POS connectivity.
- Do not expose database tie-breaker or audit jargon on printed/server-facing material.

## 10. Acceptance criteria

### Browser and inspector

- [ ] `/data` defaults to contest-week records when an active contest exists, with a clear All sales option.
- [ ] Search covers internal ID, durable external reference, server, item, import source, and correction reason across the full dataset.
- [ ] The browser is server-paginated at 25 rows and reports the displayed range/total.
- [ ] Check # is visible; View shows items, origin, and history without entering edit mode.
- [ ] Selecting View/Edit opens its inspector directly beneath the originating row.
- [ ] `Add contest sales` requires only an active contest item and quantity; it updates item-count standings without creating a check or changing check-based metrics.

### Entry and correction integrity

- [ ] Itemized create/edit shows live items total, subtotal, and difference; Save is unavailable until they reconcile.
- [ ] Check-total-only records require a note and are visibly excluded from item-based metrics.
- [ ] A correction writes both before and after snapshots plus reason/time, preserving original import/manual/seed origin.
- [ ] Revert creates a new history event; it does not delete the original correction.
- [ ] The dashboard’s Edited badge detects manual and changed records without losing original source display.

### Import preflight

- [ ] Upload does not write the database before the manager confirms.
- [ ] Header mapping, timezone confirmation, preview rows, server mapping, and grouped check validation are visible.
- [ ] Invalid item data invalidates the whole check; excluded checks require an explicit manager action.
- [ ] Exact duplicate files are rejected; revised files classify durable references as new/already-present/changed.
- [ ] Confirmed imports are transactional and history reports checks accepted/skipped/excluded plus itemized coverage.

### Fairness and query safety

- [ ] Health strip uses the same itemization condition as `alcohol_pct` and `attach_rate` metric queries.
- [ ] Correction impact is computed from raw current data and never stored as a metric.
- [ ] A post-lock correction cannot alter game awards or a wheel drawing snapshot.
- [ ] With no `OPENAI_API_KEY`, every workbench feature remains functional.

### Tests and verification

- [ ] Unit tests cover health counts, search/filter pagination, detail/origin/history, and reconciliation validation.
- [ ] Unit tests cover preflight no-write behavior, alias mapping, grouped exclusion, duplicate/changed reference detection, and transactional confirm.
- [ ] Unit tests cover correction/revert snapshots and post-lock immutability.
- [ ] Existing hand-computed metric tests continue to pass, including check-only denominator behavior.
- [ ] `npm run seed`, `npm test`, and a visual/console check of `/data` pass before handoff.

## 11. Delivery phases and cut line

### Phase A — Trustworthy workbench (required)

1. Add check ID, filters, item-detail state, health strip, and inspector View/Edit split.
2. Add item-first editor with live reconciliation and explicit check-total-only mode.
3. Preserve origin and write complete before/after correction history.
4. Add correction impact copy and post-lock immutability warning.

### Phase B — Safe CSV imports (required before claiming POS-ready CSV support)

1. Add preflight mapping, preview, timezone, server mapping, and grouped validation.
2. Store durable references/origins and import-health ledger.
3. Add new/already-present/changed reconciliation and atomic confirm.

### Phase C — Recovery polish (cuttable)

1. Add revert from the history timeline.
2. Add saved filter links from import history and `Review check-only records`.
3. Add keyboard refinements and responsive inspector polish.

If time is constrained, complete Phase A before changing the existing direct CSV import. Do not ship a partial preflight that can silently lose checks or claim an import succeeded before validation is complete.
