# Contest Manager Runbook

> Generated from `runbooks/contest-manager.json`. Edit the manifest, then run `npm run runbook:docs`.

Build, activate, verify, finalize, and draw a restaurant sales contest while preserving an auditable evidence trail and recording product-discovery observations.

## Authority

### Allowed

- Inspect all active contest and operational state
- Draft and preview contest configuration
- Activate a validated replacement contest after explicit confirmation
- Prepare Bingo cards and gameboards
- Finalize game awards after reconciliation and explicit confirmation
- Preview and run one prize drawing after explicit confirmation
- Write evidence and discovery artifacts inside the assigned run directory

### Forbidden

- Change a locked game award or saved wheel drawing
- Use real restaurant, employee, or guest data
- Edit product source or specs during an operating run
- Use SQL or an API to bypass a blocked UI discovery step
- Accept product-discovery recommendations without human triage

## CM-01: Identify the active contest

**Phase:** preflight  
**Mode:** read  
**Confirmation:** none

Open Dashboard and state the active contest name, prize, goals, last winner, and time remaining before drafting anything.

### Before starting

- SIM is running against the assigned disposable database

### Expected result

- The operator can name the current contest and prize
- The API snapshot contest ID matches the Dashboard

### Evidence

- Required: `CM-01-dashboard` at `/`; wait for “Active contest”; capture `01-active-dashboard.png`.

### Watch for

- Could a first-time manager understand what is active and what ends when?
- Is the prize prominent enough?

### Safe recovery

- Stop if the UI and snapshot name different active contests

### Do not

- Reading the database directly instead of checking the UI

## CM-02: Set contest details

**Phase:** setup  
**Mode:** ui_write  
**Confirmation:** none

Open Contest setup and enter the scenario contest name and prize. Do not activate yet.

### Before starting

- CM-01 is complete
- Scenario includes a contest name and prize

### Expected result

- Contest name and Prize show the scenario values
- The active contest remains unchanged

### Evidence

- Required: `CM-02-details` at `/contest`; wait for “Name the week and set the reward”; capture `02-contest-details.png`.

### Watch for

- Are contest name and prize described in restaurant language?
- Is it clear that nothing has changed yet?

### Safe recovery

- Record a runbook gap if the scenario cannot be represented

### Do not

- Calling activate_contest before completing the UI draft

## CM-03: Configure goals

**Phase:** setup  
**Mode:** ui_write  
**Confirmation:** none

Configure each scenario sales goal, including metric, item or category, and fixed target or house comparison.

### Before starting

- Contest details are entered

### Expected result

- Every scenario goal has one valid target
- Item-count goals identify a menu item
- Rate goals show percentages in human units

### Evidence

- Required: `CM-03-goals` at `/contest`; wait for “Choose what counts as winning”; capture `03-sales-goals.png`.

### Watch for

- Could the operator predict how each metric is calculated?
- Was choosing an item or category unnecessarily difficult?

### Safe recovery

- Stop if a required metric or item is unavailable

### Do not

- Editing config JSON directly
- Inventing a menu item ID

## CM-04: Configure prize scoring

**Phase:** setup  
**Mode:** ui_write  
**Confirmation:** none

Set entries per goal met and per Bingo daily win using the scenario values.

### Before starting

- Scenario includes entry rules

### Expected result

- Both entry values are non-negative whole numbers
- The operator can explain how the values feed the wheel

### Evidence

- Required: `CM-04-scoring` at `/contest`; wait for “Set how servers earn wheel entries”; capture `04-prize-scoring.png`.

### Watch for

- Is the relationship between goals, Bingo, games, and the wheel understandable?

### Safe recovery

- Record copy or model ambiguity before proceeding

### Do not

- Leaving values unexplained because defaults are present

## CM-05: Configure gameboards

**Phase:** setup  
**Mode:** ui_write  
**Confirmation:** none

Enable and configure the featured race and goal board required by the scenario, including names and award values.

### Before starting

- Goals and entry rules are complete

### Expected result

- The correct number of gameboards appears in the activation summary
- The featured race target matches the intended item or category

### Evidence

- Required: `CM-05-games` at `/contest`; wait for “Add live boards for the floor”; capture `05-gameboard-setup.png`.

### Watch for

- Does the board setup describe how live scores get entered?
- Are award values easy to distinguish from goal-entry rules?

### Safe recovery

- Stop if the desired board cannot express the scenario

### Do not

- Assuming a generated board name is correct without reading it

## CM-06: Preview activation

**Phase:** setup  
**Mode:** api_write  
**Confirmation:** none

Use the operations preview with the exact UI draft. Compare the normalized result with the visible form before any write.

### Before starting

- All draft sections are complete
- The active contest ID is known

### Expected result

- Preview performs no write
- Preview identifies the current contest and planned card count
- Normalized configuration matches the UI

### Evidence

- No screenshot checkpoint. Save any required preview or reconciliation output in the run artifacts.

### Watch for

- Did preview expose information the UI should show?
- Was copying the UI draft into preview burdensome?

### Safe recovery

- Return to the UI when preview reports validation differences

### Do not

- Activating without comparing preview and UI

## CM-07: Activate the contest

**Phase:** setup  
**Mode:** ui_write  
**Confirmation:** explicit

Re-read the UI warning, confirm intentionally, and activate the validated contest once.

### Before starting

- Preview succeeded
- Expected contest ID still matches
- Explicit human or scenario confirmation is present

### Expected result

- Exactly one replacement contest becomes active
- The prior contest closes
- Fresh Bingo cards exist for all active servers

### Evidence

- Required: `CM-07-activated` at `/`; wait for “Active contest”; capture `07-activated-dashboard.png`; pair with its receipt.

### Watch for

- Was the destructive effect clear before activation?
- Did confirmation or progress feedback prevent duplicate intent?

### Safe recovery

- Reconcile the operation receipt before any retry
- Stop on a stale-contest response

### Do not

- Double-clicking activation
- Retrying with a new operation ID before reconciling

## CM-08: Verify every active surface

**Phase:** evidence  
**Mode:** read  
**Confirmation:** none

Verify that Dashboard, Bingo, Sales Games, Sales Data, and Prize Wheel show the same contest and prize or targets.

### Before starting

- Activation completed

### Expected result

- All surfaces use the replacement contest
- Sales Data exposes active item-count targets
- Prize Wheel shows the intended prize

### Evidence

- Required: `CM-08-bingo` at `/bingo?server={server_id}`; wait for “Bingo cards”; capture `08-bingo-ready.png`.
- Required: `CM-08-games` at `/games`; wait for “Gameboards”; capture `08-gameboards-live.png`.
- Required: `CM-08-data` at `/data?server={server_id}&panel=contest`; wait for “Add contest sales”; capture `08-sales-targets.png`.
- Required: `CM-08-wheel` at `/wheel`; wait for “Contender field”; capture `08-wheel-field.png`.

### Watch for

- Which surface required the most context to interpret?
- Were any names, prizes, or scores inconsistent?

### Safe recovery

- Stop on any cross-surface mismatch

### Do not

- Treating API state alone as UI verification

## CM-09: Prepare floor materials

**Phase:** live  
**Mode:** ui_write  
**Confirmation:** none

Review current Bingo cards and gameboards. Re-randomize only before distribution and print the required materials.

### Before starting

- Active surfaces are consistent

### Expected result

- Distributed cards match current cards
- Printed gameboards show the active contest

### Evidence

- Optional: `CM-09-card` at `/bingo?server={server_id}`; wait for “Print card”; capture `09-floor-card.png`.

### Watch for

- Could a manager tell whether a card had already been distributed?
- Did printing require hidden knowledge?

### Safe recovery

- Stop and replace distributed copies if a card was changed

### Do not

- Re-randomizing a card after distribution
- Assuming print layout without preview

## CM-10: Reconcile live information

**Phase:** finalize  
**Mode:** decision  
**Confirmation:** none

Review recent operation receipts, live contest tallies, Bingo submissions, and check corrections before awards.

### Before starting

- The live entry period is ending

### Expected result

- Every intended write has a receipt
- No known late entry remains
- Unresolved mistakes are visible

### Evidence

- No screenshot checkpoint. Save any required preview or reconciliation output in the run artifacts.

### Watch for

- Was reconciliation available in one place?
- Could the manager find the source of a score?

### Safe recovery

- Delay finalization until unresolved operations are understood

### Do not

- Finalizing because the board looks plausible

## CM-11: Preview final awards

**Phase:** finalize  
**Mode:** read  
**Confirmation:** none

Preview race standings and goal-board eligibility without locking awards.

### Before starting

- Live information is reconciled

### Expected result

- Preview lists proposed places and entries
- Preview states whether awards or drawing are already final

### Evidence

- No screenshot checkpoint. Save any required preview or reconciliation output in the run artifacts.

### Watch for

- Did preview make late-data risk obvious?

### Safe recovery

- Return to reconciliation if preview differs from expectation

### Do not

- Using the visible row order as the only award preview

## CM-12: Finalize game awards

**Phase:** finalize  
**Mode:** ui_write  
**Confirmation:** explicit

With explicit confirmation, lock the race and award the goal board once, then verify the final board.

### Before starting

- Award preview is accepted
- Expected contest ID still matches
- Explicit confirmation is present

### Expected result

- Race places and mission awards are immutable
- Prize Wheel game-entry totals update

### Evidence

- Required: `CM-12-awards` at `/games`; wait for “Final”; capture `12-final-gameboards.png`; pair with its receipt.

### Watch for

- Was immutability clear?
- Could the operator see exactly what was awarded?

### Safe recovery

- Reconcile the original receipt if the UI response is interrupted

### Do not

- Finalizing before late-entry reconciliation
- Retrying with a new operation ID

## CM-13: Review the contender field

**Phase:** finalize  
**Mode:** read  
**Confirmation:** none

Open Prize Wheel, expand contenders, and reconcile goal, Bingo, and game entries before drawing.

### Before starting

- Game awards are final

### Expected result

- Every contender total has an understandable breakdown
- At least one server has an entry

### Evidence

- Required: `CM-13-contender` at `/wheel?server={server_id}`; wait for “Goal entries”; capture `13-contender-detail.png`.

### Watch for

- Could the manager explain each entry source aloud?
- Were zero-entry servers confusing?

### Safe recovery

- Stop if totals do not reconcile or all entries are zero

### Do not

- Drawing without reviewing the preview

## CM-14: Draw and record the winner

**Phase:** finalize  
**Mode:** ui_write  
**Confirmation:** explicit

Enter TV mode if presenting, confirm the draw, spin once, and verify winner history.

### Before starting

- Wheel preview is accepted
- No drawing exists
- Explicit confirmation is present

### Expected result

- One winner is persisted
- The entry snapshot is immutable
- Drawing history shows the winner

### Evidence

- Required: `CM-14-winner` at `/wheel`; wait for “Winner”; capture `14-prize-winner.png`; pair with its receipt.

### Watch for

- Did the presentation explain probability and entries?
- Was it clear the draw could not be repeated?

### Safe recovery

- Read back the drawing receipt and history after any interruption

### Do not

- Spinning twice
- Refreshing and retrying before receipt reconciliation

## CM-15: Debrief and propose needs

**Phase:** debrief  
**Mode:** debrief  
**Confirmation:** none

Complete observations, evidence references, and summary. Propose needs without editing SIM or accepting them.

### Before starting

- The run has ended or reached a documented blocker

### Expected result

- Every step has a result
- Friction is recorded even on passing steps
- Candidate needs have evidence and impact

### Evidence

- No screenshot checkpoint. Save any required preview or reconciliation output in the run artifacts.

### Watch for

- What did SIM force the manager to remember?
- What would be unsafe in a real shift?
- Which steps should disappear or combine?

### Safe recovery

- Mark missing evidence explicitly rather than inventing it

### Do not

- Fixing the product during debrief
- Marking a suggestion accepted
