# Shift Manager Runbook

> Generated from `runbooks/shift-manager.json`. Edit the manifest, then run `npm run runbook:docs`.

Enter live contest sales and returned Bingo cards, verify the visible boards, reconcile receipts, and hand off exceptions without changing contest rules or inventing check data.

## Authority

### Allowed

- Inspect the active contest, prize, goals, servers, boards, and recent operation receipts
- Record positive quantities for active contest item-count targets
- Log a returned current Bingo card
- Record a complete check only when every source fact is known
- Correct a source check with an audit reason
- Write evidence and discovery artifacts inside the assigned run directory

### Forbidden

- Activate or replace a contest
- Change prizes, goals, scoring, or game rules
- Lock a race, award a goal board, or draw a prize winner
- Use a negative contest tally as an offset
- Invent full-check facts to represent a contest-only quantity
- Edit product source, seed data, specs, or prompts during an operating run
- Use SQL or an API to conceal a blocked UI discovery step

## SM-01: Confirm the active shift contest

**Phase:** preflight  
**Mode:** read  
**Confirmation:** none

Open Dashboard and state the active contest, prize, goals, and remaining time before entering sales.

### Before starting

- SIM is running against the assigned disposable database

### Expected result

- The operator can name the active contest and prize
- The Dashboard and operations snapshot report the same contest ID

### Evidence

- Required: `SM-01-dashboard` at `/`; wait for “Active contest”; capture `01-shift-dashboard.png`.

### Watch for

- Could a shift manager immediately tell what item to sell and what can be won?
- Is the time window unambiguous?

### Safe recovery

- Stop if the UI and snapshot identify different contests

### Do not

- Assuming the contest from a previous shift
- Reading the database directly instead of checking the UI

## SM-02: Open a server's contest tally

**Phase:** live  
**Mode:** read  
**Confirmation:** none

Open Sales Data, find the scenario server, and select Add contest sales so the tool unfolds beneath that server row.

### Before starting

- SM-01 is complete
- The scenario server is active

### Expected result

- The tally tool opens inline under the selected server
- Only active contest item-count targets are offered

### Evidence

- Required: `SM-02-server-tally` at `/data?server={server_id}&panel=contest`; wait for “Add contest sales”; capture `02-server-tally-open.png`.

### Watch for

- Was the correct server easy to find?
- Did the row stay visually connected to its open tool?

### Safe recovery

- Stop if the target item is absent or an unrelated menu item is offered

### Do not

- Opening a detached form
- Searching the full menu to find a contest item
- Inventing a server or item ID

## SM-03: Review the contest quantity

**Phase:** live  
**Mode:** ui_write  
**Confirmation:** none

Choose the scenario contest item when necessary, enter the positive quantity, and review the automatically calculated count and value before submitting.

### Before starting

- The intended server tally is open
- The active contest and expected contest ID have not changed

### Expected result

- No party size or manual subtotal is required
- The item value is calculated automatically
- The quantity is a positive whole number

### Evidence

- Required: `SM-03-tally-ready` at `/data?server={server_id}&panel=contest`; wait for “Automatic total”; capture `03-contest-tally-ready.png`.

### Watch for

- Did the form ask for anything the shift manager should not need to know?
- Was the automatic calculation trustworthy and readable?

### Safe recovery

- Do not submit if the server, item, or calculation is wrong

### Do not

- Using Add full check
- Entering a manual subtotal
- Using a negative quantity

## SM-04: Submit and reconcile contest sales

**Phase:** live  
**Mode:** ui_write  
**Confirmation:** none

Submit the tally once, retain its operation receipt, and verify that only the scoped item count changed.

### Before starting

- SM-03 review passed
- A unique operation ID is assigned

### Expected result

- One append-only contest sales event is recorded
- The server's active item count increases by the entered quantity
- Check count, sales, and tip metrics do not change

### Evidence

- Required: `SM-04-tally-confirmed` at `/data?server={server_id}&panel=contest`; wait for “Added”; capture `04-contest-tally-confirmed.png`; pair with its receipt.

### Watch for

- Did the success message identify server, item, quantity, and resulting total?
- Could a retry be mistaken for a second sale?

### Safe recovery

- Read the original operation receipt before retrying
- Stop on a stale-contest response

### Do not

- Double-clicking submit
- Retrying with a new operation ID before reconciliation
- Treating a full check as the tally

## SM-05: Verify the live gameboard

**Phase:** evidence  
**Mode:** read  
**Confirmation:** none

Open the relevant Sales Gameboard and verify the server score reflects the successful tally.

### Before starting

- The contest tally receipt is successful

### Expected result

- The visible board agrees with the read-back snapshot
- The correct server moved by the expected amount

### Evidence

- Required: `SM-05-board-updated` at `/games?game={game_id}`; wait for “Gameboards”; capture `05-gameboard-updated.png`; pair with its receipt.

### Watch for

- How long did it take to connect the entry to the correct board?
- Was it clear whether the board updated live or needed refresh?

### Safe recovery

- Record a data mismatch and stop additional entries if the receipt and board disagree

### Do not

- Using the API snapshot as a substitute for viewing the board

## SM-06: Mark a returned Bingo card

**Phase:** live  
**Mode:** ui_write  
**Confirmation:** none

Select the returned current card and mark only completed squares. Click individual squares or drag along one logical row, column, or diagonal; ignore near-miss squares that do not continue that line.

### Before starting

- The physical or scenario card belongs to the selected server
- The card has not been re-randomized since distribution

### Expected result

- Marked cells match the returned card
- FREE counts automatically
- A drag gesture does not collect unrelated near-miss squares

### Evidence

- Required: `SM-06-bingo-marked` at `/bingo?server={server_id}`; wait for “Log turned-in card”; capture `06-bingo-card-marked.png`.

### Watch for

- Did click-and-drag follow the operator's intended line?
- Could the manager spot a stale or wrong server card before submission?

### Safe recovery

- Clear incorrect marks before submitting
- Stop if the current UI card differs from the returned card

### Do not

- Marking an assumed line
- Using a stale card
- Adding off-line squares from an imprecise drag

## SM-07: Log the returned Bingo card

**Phase:** live  
**Mode:** ui_write  
**Confirmation:** none

Select Log turned-in card once, retain the operation receipt, and read the line, daily-win, and wheel-entry result.

### Before starting

- The marked card has been visually checked
- A unique operation ID is assigned

### Expected result

- The submission reports completed lines
- At most one daily win is awarded for the server and business date
- Wheel entries are added only while the drawing is open

### Evidence

- Required: `SM-07-bingo-confirmed` at `/bingo?server={server_id}`; wait for “Lines”; capture `07-bingo-submission.png`; pair with its receipt.

### Watch for

- Did the result distinguish completed lines from daily-win eligibility?
- Was a duplicate submission understandable?

### Safe recovery

- Reconcile the original receipt after interruption
- Stop on stale-card or stale-contest errors

### Do not

- Submitting a second time with a new operation ID
- Assuming a daily win from line count alone

## SM-08: Record a complete check when required

**Phase:** live  
**Mode:** ui_write  
**Confirmation:** none

Use Add full check only when the scenario provides the server, opened time, party size, every item line, and complete check facts. Let item lines calculate subtotal automatically.

### Before starting

- The scenario explicitly requires a complete check
- All source facts are known

### Expected result

- The check reconciles without duplicate subtotal entry
- Check-based metrics update from the saved source record

### Evidence

- Optional: `SM-08-full-check` at `/data?server={server_id}&panel=checks`; wait for “Add full check”; capture `08-full-check-recorded.png`; pair with its receipt.

### Watch for

- Did the workflow require duplicated arithmetic?
- Was the difference between contest sales and full checks clear?

### Safe recovery

- Skip and record the missing source facts rather than fabricate them

### Do not

- Inventing party size, items, tax, tip, or totals
- Using a full check for contest-only sales

## SM-09: Correct a source check with a reason

**Phase:** live  
**Mode:** ui_write  
**Confirmation:** none

When the scenario identifies an incorrect source check, expand Checks beneath the server, edit that check inline, and give a specific correction reason.

### Before starting

- The incorrect check and corrected source facts are known

### Expected result

- The correction remains associated with the source check
- The audit trail preserves the reason and prior values
- Derived metrics reflect the corrected check

### Evidence

- Optional: `SM-09-check-corrected` at `/data?check={check_id}&panel=edit`; wait for “Correction reason”; capture `09-check-corrected.png`; pair with its receipt.

### Watch for

- Could the source check be located without leaving the server context?
- Was the audit impact clear before saving?

### Safe recovery

- Stop if the original check cannot be uniquely identified

### Do not

- Editing the database
- Creating an offsetting fake check
- Using a vague audit reason

## SM-10: Document entry exceptions

**Phase:** live  
**Mode:** decision  
**Confirmation:** none

If a contest tally was entered incorrectly or any live workflow cannot recover safely, record the exact server, item, quantity, time, operation ID, observed result, and needed recovery for manager handoff.

### Before starting

- An exception or uncertainty exists

### Expected result

- No negative offset is created
- The exception is precise enough for a manager to investigate
- The observation identifies a missing capability when appropriate

### Evidence

- No screenshot checkpoint. Save any required preview or reconciliation output in the run artifacts.

### Watch for

- Could the shift manager correct the mistake safely?
- What information did the handoff require SIM to remember externally?

### Safe recovery

- Leave the successful append-only event intact and escalate the referenced receipt

### Do not

- Deleting the event
- Adding a negative quantity
- Changing source code during the run

## SM-11: Reconcile and hand off the shift

**Phase:** debrief  
**Mode:** debrief  
**Confirmation:** none

Reconcile every intended action to one operation receipt, verify required evidence, record friction even for passing steps, and complete the shift summary without fixing the product.

### Before starting

- The scenario ended or reached a documented blocker

### Expected result

- Every intended write is applied, already applied, blocked, or explicitly skipped
- All anomalies and evidence gaps are handed off
- Candidate product needs remain unaccepted pending human triage

### Evidence

- No screenshot checkpoint. Save any required preview or reconciliation output in the run artifacts.

### Watch for

- What did SIM force the shift manager to remember outside the app?
- Which live actions took too many steps?
- Which success states were ambiguous?

### Safe recovery

- Mark missing evidence or unresolved actions explicitly rather than inventing completion

### Do not

- Claiming completion with missing receipts
- Fixing SIM during debrief
- Marking a candidate need accepted
