# SIM demo video production script

Target runtime: **2:30** at 1920×1080, 30fps. The edit uses hard cuts and one `slide_up` entrance family throughout. All people, menu items, contests, and sales records shown are fictional seeded data.

## Scene 1 — Hook (0:00–0:10)

**Picture:** Runbook dashboard hero, framed on the active `Corn Cup Countdown` card and the first leaderboard rows.

**Narration:**

Restaurant sales contests still live on whiteboards, manual tallies, and whoever remembers what changed.

SIM replaces the guesswork with one auditable workspace.

**Suggested overlay:** `Sales contests, without the guesswork.`

**Asset:** Reuse `07-activated-dashboard.png` from the completed Contest Manager run.

## Scene 2 — Zero config (0:10–0:22)

**Picture:** Clean terminal runs the three setup commands, then cuts to the first dashboard load.

**Narration:**

SIM starts with three commands: install, seed, and run.

The deterministic fictional dataset makes every screen useful immediately, with no external service or account.

**Suggested overlays:** `npm install` · `npm run seed` · `npm run dev`

**New capture required:** Terminal plus first page load. Hide local usernames, paths, environment values, and secrets.

## Scene 3 — Dashboard (0:22–0:43)

**Picture:** Start on the active contest and prize, switch one leaderboard metric, then make one slow move through the server rows.

**Narration:**

One dashboard ranks every server across live sales metrics, contest goals, and daily Bingo wins.

Managers can switch the performance lens while the active prize, targets, last winner, and deadline stay visible.

Every downstream game reads the same sales records.

**Suggested overlays:** `Live metrics` · `Goals + daily wins` · `One source of truth`

**Capture note:** Match the framing in the Contest Manager `07-activated-dashboard.png` evidence.

## Scene 4 — AI Contest Designer (0:43–1:15)

**Picture:** A sanitized live request sends a fictional manager goal to the Contest Designer endpoint. Show the keyless sample response label and the documented GPT-5.6 production path, then cut to the real manual Contest setup UI.

**Narration:**

With an API key, GPT-5.6 receives the manager goal, menu, and four-week performance context.

Strict JSON schema constrains the response, then local validation checks every menu ID and contest rule.

Validation failure retries once. Without a key, or after two failed attempts, SIM loads its versioned sample config.

The API-backed draft is reviewed and activated through manual Contest setup.

**Suggested overlays:** `GPT-5.6 + strict json_schema` · `Local validation` · `Retry once` · `No key? Sample config, never a crash`

**Truthfulness constraint:** The current `/contest` UI is a manual builder and does not expose a prompt field. Do not stage a fake UI interaction or imply that the API response automatically fills the form. Use `05-gameboard-setup.png` as the populated-UI visual reference.

**New capture required:** Sanitized API proof plus the real populated Contest setup UI. No API key may appear anywhere.

## Scene 5 — Sales games (1:15–1:30)

**Picture:** Final `Corn Cup Sprint` standings and the awarded `Corn Cup Crew Goal` board.

**Narration:**

Sales games turn the same live totals into a visible floor race and a shared goal board.

Final awards become wheel entries, keeping every contest mechanic connected and auditable.

**Suggested overlays:** `Live floor race` · `Shared goal board` · `Awards → wheel entries`

**Asset:** Crop the top of Contest Manager `12-final-gameboards.png` to 16:9 without stretching it.

## Scene 6 — Server Bingo (1:30–1:46)

**Picture:** Avery Moss's card, one fast row-mark gesture, then print preview showing one clean card per page.

**Narration:**

Every server gets a randomized five-by-five card drawn from the active contest's menu pool.

Managers print one clean card per page, then log completed lines and daily wins when cards return.

**Suggested overlays:** `12 fresh cards per contest` · `Tap or drag a line` · `One card per printed page`

**Evidence references:** Contest Manager `08-bingo-ready.png`; Shift Manager `06-bingo-card-marked.png` and `07-bingo-submission.png`.

**New capture required:** The print view is not present in the runbook evidence, so capture it live. Keep the role-sensitive Re-randomize control out of the editorial focus.

## Scene 7 — Prize wheel (1:46–2:08)

**Picture:** Expand one contender's entry breakdown, confirm one draw, retain the full five-second spin, and hold on the persisted winner.

**Narration:**

Before drawing, the contender panel explains goal, Bingo, and game entries for each server.

One confirmed draw saves an immutable snapshot first; only then does the wheel animate toward the recorded winner.

The presentation stays exciting without letting animation decide the result.

**Suggested overlays:** `Explain every entry` · `Snapshot first` · `Animate second` · `One saved winner`

**Evidence references:** Contest Manager `13-contender-detail.png` and `14-prize-winner.png` establish the before-and-after frames.

**New capture required:** A real spin from a fresh disposable drawing state. Never reset or redraw the completed runbook database.

## Scene 8 — Sales data (2:08–2:19)

**Picture:** Quantity-only contest tally and automatic total, then a quick move to CSV import and the editable current-data table.

**Narration:**

Shift leaders add contest-only quantities without inventing check data.

For complete records, SIM also imports CSVs and preserves corrections in an audit trail.

**Suggested overlays:** `Item + quantity` · `CSV import` · `Audited corrections`

**Evidence reference:** Shift Manager `03-contest-tally-ready.png` is the framing baseline.

**New capture required:** Do not submit another runbook operation and do not import real data.

## Scene 9 — Close (2:19–2:30)

**Picture:** SIM end card with product name, Build Week attribution, and verified public repository URL.

**Narration:**

SIM turns restaurant sales into one connected, accountable weekly game.

Built in Codex with GPT-5.6; source and the reproducible demo pipeline are in the repository.

**Suggested overlay:** `Built in Codex with GPT-5.6`

**Production blocker:** No public repository remote is configured in this checkout. Replace `[PUBLIC_REPO_URL]` below and on the end card only after Estevan supplies or verifies it.

## YouTube package

### Title

SIM: Sales Incentive Machine | OpenAI Build Week Demo

### Description

SIM is a local-first restaurant sales-contest workspace for manager dashboards, live sales games, printable Server Bingo cards, auditable sales records, and one immutable weekly prize drawing.

The Contest Designer API uses GPT-5.6 structured output with a strict JSON schema, validates the result against real fictional menu IDs, retries once after validation failure, and falls back to a versioned sample configuration when no key is available. The product remains fully demoable with zero external configuration.

Built in Codex with GPT-5.6 for OpenAI Build Week. All restaurant, employee, menu, contest, and sales data shown is fictional.

Repository: [PUBLIC_REPO_URL]

Local start:

```text
npm install
npm run seed
npm run dev
```

### Thumbnail suggestion

Use a clean 1280×720 split composition: the SIM dashboard leaderboard on the left and the prize wheel with its winner banner on the right. Add one short headline in large warm-cream type: **SALES CONTESTS THAT RUN THEMSELVES**. Keep the SIM amber accent, dark workspace background, and no more than three focal elements.

## Capture inventory

Existing evidence supplies the hook, populated contest setup reference, final sales games, Bingo before/after states, sales-tally framing, contender breakdown, and winner payoff.

Genuinely missing live assets:

1. Zero-config terminal and first load.
2. Dashboard metric interaction.
3. Sanitized Contest Designer API proof joined to the real manual setup UI.
4. Bingo marking plus print preview.
5. One real prize-wheel spin from a fresh disposable state.
6. Sales tally to import/edit navigation.
7. End card after the public repository URL is verified.
