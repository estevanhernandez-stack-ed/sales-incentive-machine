import { execFile } from "node:child_process";
import { mkdir, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { chromium } from "playwright";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const manifestPath = path.resolve(process.argv[2] ?? path.join(repoRoot, "demo/manifest.json"));
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const scenes = Array.isArray(manifest) ? manifest : manifest.scenes;
const args = process.argv.slice(2);
const valueAfter = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : undefined; };
const baseUrl = valueAfter("--base-url") ?? process.env.DEMO_BASE_URL ?? manifest.captureBaseUrl ?? "http://127.0.0.1:3001";
const selectedScene = valueAfter("--scene");
const shouldSeed = args.includes("--seed");
const resolveManifestPath = (value) => path.isAbsolute(value) ? value : /^(demo|artifacts)[\\/]/.test(value) ? path.resolve(repoRoot, value) : path.resolve(path.dirname(manifestPath), value);
const shotsDir = resolveManifestPath(manifest.shotsDir ?? "shots");
const headless = process.env.DEMO_HEADLESS !== "0";
const execFileAsync = promisify(execFile);

function withinShotsDir(file) {
  const relative = path.relative(shotsDir, file);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function captureOutput(scene, index, kind) {
  const capture = scene.capture ?? {};
  const extension = kind === "clip" ? ".webm" : ".png";
  const requested = capture.output ?? scene.src ?? scene.asset ?? `scene_${String(index + 1).padStart(2, "0")}${extension}`;
  const output = resolveManifestPath(requested);
  if (!withinShotsDir(output)) throw new Error(`Capture output must be inside ${shotsDir}: ${output}`);
  return output;
}

function captureKind(scene) {
  const value = scene.capture?.kind ?? scene.capture?.type ?? scene.type;
  return value === "clip" || value === "video" ? "clip" : "still";
}

async function perform(page, action) {
  const type = action.type ?? action.action;
  const selector = action.selector ?? (action.text ? `text=${action.text}` : undefined);
  if (type === "click") await page.locator(selector).click();
  else if (type === "fill") await page.locator(selector).fill(String(action.value ?? action.text ?? ""));
  else if (type === "press") await page.locator(selector).press(action.key);
  else if (type === "check") await page.locator(selector).check();
  else if (type === "select") await page.locator(selector).selectOption(action.value);
  else if (type === "wait") await page.waitForTimeout(Number(action.ms ?? action.duration ?? 500));
  else if (type === "waitFor") await page.locator(selector).waitFor({ state: action.state ?? "visible" });
  else if (type === "goto") await page.goto(new URL(action.url ?? action.path, baseUrl).href, { waitUntil: "networkidle" });
  else if (type === "scroll") await page.mouse.wheel(Number(action.x ?? 0), Number(action.y ?? 700));
  else throw new Error(`Unsupported capture action: ${type}`);
  if (action.afterMs) await page.waitForTimeout(Number(action.afterMs));
}

async function preparePage(page, scene) {
  const capture = scene.capture;
  const route = capture.url ?? capture.route ?? capture.path ?? scene.url ?? scene.route ?? "/";
  await page.goto(new URL(route, baseUrl).href, { waitUntil: "networkidle" });
  if (capture.waitFor) await page.locator(capture.waitFor).waitFor({ state: "visible" });
  if (capture.delayMs) await page.waitForTimeout(Number(capture.delayMs));
  for (const action of capture.actions ?? []) await perform(page, action);
}

const cardCss = `
  *{box-sizing:border-box}body{margin:0;width:1920px;height:1080px;background:#0a1524;color:#fff;font-family:Arial,sans-serif;display:grid;place-items:center}
  main{width:1540px;padding:90px;border:2px solid #223a54;border-radius:36px;background:linear-gradient(145deg,#0f1f31,#192e44);box-shadow:0 40px 100px #0008}
  .eyebrow{font:700 24px monospace;letter-spacing:.15em;text-transform:uppercase;color:#17d4fa}h1{font-size:76px;line-height:1.05;margin:22px 0 30px}p{font-size:32px;line-height:1.45;color:#c4cdda;margin:12px 0}
  code{font:28px monospace;color:#2bd99a}.accent{color:#f22f89}.commands{display:grid;gap:14px;margin-top:36px;padding:30px;background:#08111e;border-radius:18px}
`;

async function showCard(page, eyebrow, title, lines) {
  await page.setContent(`<style>${cardCss}</style><main><div class="eyebrow">${eyebrow}</div><h1>${title}</h1>${lines.map((line) => `<p>${line}</p>`).join("")}</main>`);
}

async function runBuiltInClip(page, scene) {
  const route = scene.capture.route ?? "/";
  if (scene.id === "02-zero-config") {
    await showCard(page, "Zero configuration", "Three commands. A useful app.", [`<code>npm install</code>`, `<code>npm run seed</code>`, `<code>npm run dev</code>`]);
    await page.waitForTimeout(4500);
    await page.goto(new URL("/", baseUrl).href, { waitUntil: "networkidle" });
    await page.waitForTimeout(6500);
    return;
  }
  if (scene.id === "03-dashboard") {
    await page.goto(new URL(route, baseUrl).href, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    const metric = page.locator(".metric-picker select");
    if (await metric.count()) {
      const options = await metric.locator("option").all();
      if (options.length > 1) await metric.selectOption({ index: 1 });
    }
    await page.waitForTimeout(4000);
    await page.mouse.wheel(0, 620);
    await page.waitForTimeout(7500);
    return;
  }
  if (scene.id === "04-ai-contest-designer") {
    await page.goto(new URL("/", baseUrl).href, { waitUntil: "networkidle" });
    const apiProof = await page.evaluate(async () => {
      const response = await fetch("/api/contest-designer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "Build a weekly contest around Ember Corn Cups and balanced guest engagement." }),
      });
      const body = await response.json();
      return { status: response.status, label: String(body.label ?? "Validated contest config") };
    });
    const safeLabel = apiProof.label.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    await showCard(page, "Contest Designer API — live response", "Plain goal → validated contest config", [
      `<code>POST /api/contest-designer → ${apiProof.status}</code>`,
      `Live response: <span class="accent">${safeLabel}</span>`,
      `Production path: GPT-5.6 · strict JSON schema · local ID validation · one retry`,
      `No key? The versioned sample keeps the whole product demoable.`,
    ]);
    await page.waitForTimeout(9000);
    await page.goto(new URL(route, baseUrl).href, { waitUntil: "networkidle" });
    await page.waitForTimeout(12000);
    await page.mouse.wheel(0, 650);
    await page.waitForTimeout(6000);
    return;
  }
  if (scene.id === "06-server-bingo") {
    await page.goto(new URL(route, baseUrl).href, { waitUntil: "networkidle" });
    const cells = page.locator(".bingo-grid .bingo-cell:not(.free)");
    if (await cells.count() < 5) throw new Error("Required Bingo grid is unavailable.");
    for (let index = 0; index < 5; index += 1) { await cells.nth(index).click(); await page.waitForTimeout(280); }
    await page.waitForTimeout(4500);
    await page.emulateMedia({ media: "print" });
    await page.waitForTimeout(5500);
    return;
  }
  if (scene.id === "07-prize-wheel") {
    await page.goto(new URL(route, baseUrl).href, { waitUntil: "networkidle" });
    const spin = page.locator(".spin-button");
    if (await spin.count() !== 1 || !(await spin.isEnabled())) {
      throw new Error("Required prize-wheel draw is unavailable. Run `npm run seed` or capture with --seed; a completed drawing is never bypassed.");
    }
    page.once("dialog", (dialog) => dialog.accept());
    await spin.click();
    await page.waitForTimeout(7500);
    if (!await page.getByText(/takes it\.|wins/i).count()) throw new Error("Prize-wheel animation ended without a persisted winner.");
    await page.waitForTimeout(7500);
    return;
  }
  if (scene.id === "08-sales-data") {
    await page.goto(new URL(route, baseUrl).href, { waitUntil: "networkidle" });
    if (!await page.getByText("Live contest tally").count()) throw new Error("Required contest tally panel is unavailable.");
    await page.waitForTimeout(4500);
    await page.getByText("Import a sheet").scrollIntoViewIfNeeded();
    await page.waitForTimeout(5500);
    return;
  }
  await preparePage(page, scene);
  await page.waitForTimeout(Number(scene.capture.holdMs ?? Math.max(2500, (scene.duration ?? 4) * 1000 - 1000)));
}

async function captureStill(browser, scene, index) {
  const output = captureOutput(scene, index, "still");
  await mkdir(path.dirname(output), { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await preparePage(page, scene);
  await page.screenshot({ path: output, fullPage: Boolean(scene.capture.fullPage), animations: "disabled" });
  await context.close();
  console.log(`Captured still ${path.relative(repoRoot, output)}`);
}

async function captureRunbookStill(browser, scene, index) {
  const source = resolveManifestPath(scene.capture.source_asset);
  const output = captureOutput(scene, index, "still");
  const bytes = await readFile(source);
  const mime = path.extname(source).toLowerCase() === ".jpg" || path.extname(source).toLowerCase() === ".jpeg" ? "image/jpeg" : "image/png";
  await mkdir(path.dirname(output), { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const sourceUrl = `data:${mime};base64,${bytes.toString("base64")}`;
  if (scene.id === "05-sales-games") {
    await page.setContent(`<style>*{box-sizing:border-box}html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#0a1524}.split{display:grid;grid-template-columns:1fr 1fr;gap:18px;width:100%;height:100%;padding:28px}.panel{position:relative;overflow:hidden;border:1px solid #453a30;border-radius:18px;background:#17130f}.panel:after{position:absolute;z-index:2;left:24px;top:20px;padding:8px 12px;border-radius:999px;color:#fff7ed;background:#20170fdd;font:700 18px monospace;letter-spacing:.08em}.race:after{content:'FINAL RACE'}.goal:after{content:'AWARDED GOAL BOARD'}.panel img{display:block;width:100%;height:100%;object-fit:cover}.race img{object-position:top center}.goal img{position:absolute;left:-20%;bottom:0;width:140%;height:140%;object-position:bottom center}</style><div class="split"><div class="panel race"><img src="${sourceUrl}"></div><div class="panel goal"><img src="${sourceUrl}"></div></div>`);
  } else {
    await page.setContent(`<style>*{box-sizing:border-box}html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#0a1524}img{display:block;width:100%;height:100%;object-fit:cover;object-position:top center}</style><img src="${sourceUrl}">`);
  }
  await page.locator("img").first().waitFor({ state: "visible" });
  await page.screenshot({ path: output, animations: "disabled" });
  await context.close();
  console.log(`Framed runbook still ${path.relative(repoRoot, output)}`);
}

async function captureClip(browser, scene, index) {
  const output = captureOutput(scene, index, "clip");
  const tempDir = path.join(shotsDir, ".recording", `scene_${index + 1}`);
  await rm(tempDir, { recursive: true, force: true });
  await mkdir(tempDir, { recursive: true });
  await mkdir(path.dirname(output), { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: tempDir, size: { width: 1920, height: 1080 } },
  });
  const page = await context.newPage();
  const video = page.video();
  await runBuiltInClip(page, scene);
  await page.close();
  await context.close();
  const recorded = await video.path();
  await rm(output, { force: true });
  await rename(recorded, output);
  await rm(tempDir, { recursive: true, force: true });
  console.log(`Captured clip ${path.relative(repoRoot, output)}`);
}

async function main() {
  if (!Array.isArray(scenes)) throw new Error("Manifest must contain a scenes array.");
  if (shouldSeed) {
    console.log("Resetting the deterministic demo database before capture.");
    await execFileAsync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "seed"], { cwd: repoRoot });
  }
  const captureScenes = scenes.filter((scene) => scene.capture && scene.capture !== false && (!selectedScene || scene.id === selectedScene));
  if (captureScenes.length === 0) {
    console.log("No scenes contain capture instructions; nothing to capture.");
    return;
  }
  await mkdir(shotsDir, { recursive: true });
  const browser = await chromium.launch({ headless });
  try {
    for (const [index, scene] of scenes.entries()) {
      if (!captureScenes.includes(scene)) continue;
      const status = scene.capture.status;
      if (status === "reuse_runbook_still" && scene.capture.source_asset) {
        await captureRunbookStill(browser, scene, index);
      } else if (status === "generated_title_card") {
        const output = captureOutput(scene, index, "still");
        await mkdir(path.dirname(output), { recursive: true });
        const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
        const page = await context.newPage();
        await showCard(page, "Sales Incentive Machine", "Built in Codex with <span class=\"accent\">GPT-5.6</span>", ["One connected, accountable weekly game.", "Source and reproducible demo pipeline in the repository."]);
        await page.screenshot({ path: output });
        await context.close();
        console.log(`Generated title card ${path.relative(repoRoot, output)}`);
      } else if (captureKind(scene) === "clip") await captureClip(browser, scene, index);
      else await captureStill(browser, scene, index);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
