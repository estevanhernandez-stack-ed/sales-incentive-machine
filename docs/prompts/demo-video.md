# Codex prompt: build the SIM demo video pipeline

> Paste everything below this line into Codex in the sales-incentive-machine repo, or tell Codex to read this file and execute it.

---

Build a demo-video pipeline for SIM's hackathon submission, then render the video. Target: under 3 minutes (aim for 2:15–2:40), 1920×1080 landscape, 30fps, destined for public YouTube and the Devpost embed. ffmpeg 8.x is installed and on PATH.

## Deliverables

1. `scripts/demo-video/build.mjs` — renderer. Reads a JSON manifest, renders each scene as its own segment via ffmpeg, concatenates losslessly, writes the final mp4.
2. `scripts/demo-video/capture.mjs` — Playwright capture script (devDependency only) that produces stills and screen-recorded clips of the running app into `demo/shots/`.
3. `demo/manifest.json` — the scene plan. Versioned: this file is the video's source code.
4. `demo/demo-script.md` — narration lines, suggested overlay text, YouTube title + description + thumbnail suggestion. Versioned.
5. `demo/out/sim-demo.mp4` — the rendered video. Gitignored, along with `demo/shots/` and `demo/voiceover/`.

## Pipeline design (follow this — it is a proven recipe, not a suggestion)

- Each scene renders as an independent H.264/AAC segment, then concat with `-c copy`. Hard cuts between scenes, no cross-fades — entrance motion inside a scene supplies the energy. Pick one effect family and use it for the whole video; variety reads as chaos.
- Output settings: `libx264 -preset medium -crf 20`, `-r 30`, `aac -b:a 160k -ar 44100 -ac 2`, `-movflags +faststart`, `-pix_fmt yuv420p`. Round all scaled dimensions to even numbers.
- Scenes accept **stills** or **video clips**:
  - Stills fit within ~92% of the canvas, aspect preserved, never stretched. Entrance animation via animated overlay x/y expressions (`overlay=x='…':y='…':eval=frame`), ease-out cubic: `p = 1-(1-u)^3` with `u = min(max((t-t0)/0.45,0),1)`, entrance length 0.45s. Supported effects: `slide_up`, `slide_left`, `fade`.
  - Clips trim to scene length, scale to fit, `setsar=1`.
- Any asset that does not fill 16:9 sits on a blurred self-fill background:
  `scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,gblur=sigma=28,eq=brightness=-0.08,setsar=1`
- Timing: scene length = `max(narration_duration + 0.35, 2.5)` seconds. Scene 1 gets +0.5s so the hook lands. An explicit `"duration"` in the manifest always overrides. Print a warning if total runtime exceeds 2:55.

## Voiceover

- Default: OpenAI TTS using the existing `OPENAI_API_KEY` from `.env.local`, model `process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts"`. Generate one mp3 per scene into `demo/voiceover/slide_NN.mp3` plus a `durations.json`.
- **No key → render silent** with default scene durations, keep every narration line in `demo-script.md` for manual recording, exit 0. Same fallback contract as the contest designer: never throw on a missing key.
- If mp3s already exist in `demo/voiceover/`, use them as-is and skip TTS — the manifest only reads the directory. This allows swapped-in human or third-party narration without touching code.
- In each segment, pad narration audio to scene length (`apad`); silent scenes get `anullsrc=r=44100:cl=stereo`.

## Storyboard (keep this order; tune the words)

1. **Hook (~8s).** The pain: restaurant sales contests live on a whiteboard and someone's guesswork. Dashboard hero shot or title card.
2. **Zero config (~12s).** Terminal clip: `npm install && npm run seed && npm run dev`, then the first page load. Judges run exactly these commands — show them working.
3. **Dashboard (~20s).** Leaderboard, pace against goal, live metrics.
4. **AI Contest Designer (~30s).** The star beat: GPT-5.6 turns a manager's plain-words goal into a validated contest config — strict json_schema, retry on validation failure, sample-config fallback when keyless. Give this the most screen time; it is the built-with-GPT-5.6 proof.
5. **Sales games (~15s).**
6. **Server Bingo (~15s).** Card grid plus the print view.
7. **Prize wheel (~20s).** Record a real spin — the draw resolves first, then the wheel animates to the winner. The payoff shot.
8. **Sales data editing/import (~10s).** Quick beat.
9. **Close (~10s).** "Built in Codex with GPT-5.6." Repo link on screen.

## demo-script.md must include

Per-scene narration (8–20 words per line, conversational — a 40-word narration line makes a 12-second scene and kills the pace), suggested on-screen overlay text (nothing burned into the video unless the manifest explicitly says so), YouTube title, YouTube description with the repo link and a built-with-Codex-and-GPT-5.6 line, and a thumbnail suggestion.

## Rules

- Fake data only — the seeded names. No real restaurants, brands, or people.
- No secrets: keys via env only, nothing in the manifest or scripts. `demo/out/`, `demo/shots/`, `demo/voiceover/` are gitignored.
- Do not touch app code. Playwright lands in devDependencies only; production dependencies stay clean.
- Conventional commits. Commit the pipeline, manifest, and demo-script.md when done.

## Acceptance criteria

- `node scripts/demo-video/build.mjs demo/manifest.json` reproduces the mp4 from existing assets on any machine with ffmpeg on PATH.
- Final mp4 is ≤ 2:55, 1920×1080, 30fps, faststart, plays in a stock player.
- Narration aligns with its scene; no scene is shorter than its narration.
- `npm test` stays green and `npm run build` is unaffected.
