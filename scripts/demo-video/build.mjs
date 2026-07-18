import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const manifestPath = path.resolve(process.argv[2] ?? path.join(repoRoot, "demo/manifest.json"));
let ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";
let ffprobe = process.env.FFPROBE_PATH ?? "ffprobe";
const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;
const MIN_SCENE_DURATION = 2.5;
const DEFAULT_SILENT_DURATION = 8;
const RUNTIME_WARNING_SECONDS = 175;

function resolveFromManifest(value) {
  if (path.isAbsolute(value)) return value;
  if (/^(demo|artifacts|scripts)[\\/]/.test(value)) return path.resolve(repoRoot, value);
  return path.resolve(path.dirname(manifestPath), value);
}

function sceneAsset(scene) {
  const value = scene.src ?? scene.asset ?? scene.path ?? scene.source;
  if (!value) throw new Error(`Scene ${scene.id ?? "(unnamed)"} has no src/asset/path/source.`);
  return resolveFromManifest(value);
}

function sceneType(scene, asset) {
  if (scene.type === "still" || scene.type === "clip") return scene.type;
  return /\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(asset) ? "clip" : "still";
}

function sceneNarration(scene) {
  return scene.narration ?? scene.voiceover ?? scene.script ?? "";
}

function slideNumber(scene, index) {
  const explicit = Number(scene.number ?? scene.slide);
  return Number.isInteger(explicit) && explicit > 0 ? explicit : index + 1;
}

function voiceoverPath(scene, index, voiceoverDir) {
  const override = scene.audio ?? scene.voiceoverFile;
  return override ? resolveFromManifest(override) : path.join(voiceoverDir, `slide_${String(slideNumber(scene, index)).padStart(2, "0")}.mp3`);
}

async function run(command, args, options = {}) {
  const rendered = `${command} ${args.map((arg) => JSON.stringify(arg)).join(" ")}`;
  console.log(`\n${rendered}`);
  try {
    return await execFileAsync(command, args, { cwd: repoRoot, maxBuffer: 16 * 1024 * 1024, ...options });
  } catch (error) {
    if (error.stdout) process.stdout.write(error.stdout);
    if (error.stderr) process.stderr.write(error.stderr);
    throw error;
  }
}

async function findTool(command, fallbackName) {
  try {
    await run(command, ["-version"]);
    return command;
  } catch (initialError) {
    if (process.platform === "win32" && process.env.LOCALAPPDATA) {
      const fallback = path.join(process.env.LOCALAPPDATA, "Microsoft", "WinGet", "Links", fallbackName);
      if (existsSync(fallback)) {
        await run(fallback, ["-version"]);
        return fallback;
      }
    }
    throw new Error(`${command} was not found. Install ffmpeg 8.x or set FFMPEG_PATH/FFPROBE_PATH.`, { cause: initialError });
  }
}

async function mediaDuration(file) {
  const { stdout } = await run(ffprobe, [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    file,
  ]);
  const duration = Number(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) throw new Error(`Could not determine duration of ${file}`);
  return duration;
}

async function loadLocalEnv() {
  const envPath = path.join(repoRoot, ".env.local");
  if (!existsSync(envPath)) return;
  const source = await readFile(envPath, "utf8");
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

async function generateVoiceover(scene, index, destination, manifest) {
  const narration = sceneNarration(scene);
  if (!narration) return false;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return false;
  const voiceoverConfig = typeof manifest.voiceover === "object" ? manifest.voiceover : {};
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts",
      voice: scene.voice ?? voiceoverConfig.voice ?? manifest.voice ?? process.env.OPENAI_TTS_VOICE ?? "coral",
      input: narration,
      instructions: scene.voiceInstructions ?? manifest.voiceInstructions,
      response_format: "mp3",
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`TTS failed for scene ${index + 1}: ${response.status} ${detail}`);
  }
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
  console.log(`Generated ${path.relative(repoRoot, destination)}`);
  return true;
}

function fitFilters(inputLabel, type, duration, effect, trimStart) {
  const durationText = duration.toFixed(3);
  const timeBase = type === "clip"
    ? `trim=start=${trimStart.toFixed(3)},setpts=PTS-STARTPTS,fps=${FPS},tpad=stop_mode=clone:stop_duration=${durationText},trim=duration=${durationText}`
    : `trim=duration=${durationText},setpts=PTS-STARTPTS,fps=${FPS}`;
  const shared = [
    `[${inputLabel}]${timeBase},split=2[bgsrc][fgsrc]`,
    `[bgsrc]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT},gblur=sigma=28,eq=brightness=-0.08,setsar=1[bg]`,
    `[fgsrc]scale=1766:994:force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1[fg]`,
  ];
  const u = "min(max((t-0.10)/0.45,0),1)";
  const p = `(1-pow(1-${u},3))`;
  if (effect === "slide_left") {
    shared.push(`[bg][fg]overlay=x='-w+((W-w)/2+w)*${p}':y='(H-h)/2':eval=frame:shortest=1,format=yuv420p[v]`);
  } else if (effect === "fade") {
    shared[2] = `[fgsrc]scale=1766:994:force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1,format=rgba,fade=t=in:st=0.10:d=0.45:alpha=1[fg]`;
    shared.push(`[bg][fg]overlay=x='(W-w)/2':y='(H-h)/2':eval=frame:shortest=1,format=yuv420p[v]`);
  } else {
    shared.push(`[bg][fg]overlay=x='(W-w)/2':y='H+((H-h)/2-H)*${p}':eval=frame:shortest=1,format=yuv420p[v]`);
  }
  return shared;
}

function audioFilter(hasAudio, duration) {
  const durationText = duration.toFixed(3);
  const source = hasAudio ? "[1:a]" : "[1:a]";
  return `${source}atrim=0:${durationText},apad=whole_dur=${durationText},atrim=0:${durationText},aresample=44100,aformat=sample_rates=44100:channel_layouts=stereo[a]`;
}

async function renderSegment({ scene, index, asset, type, audio, duration, effect, trimStart, destination }) {
  const visualInput = type === "still"
    ? ["-loop", "1", "-framerate", String(FPS), "-i", asset]
    : ["-i", asset];
  const audioInput = audio
    ? ["-i", audio]
    : ["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo"];
  const filters = [...fitFilters("0:v", type, duration, effect, trimStart), audioFilter(Boolean(audio), duration)].join(";");
  await run(ffmpeg, [
    "-y", ...visualInput, ...audioInput,
    "-filter_complex", filters,
    "-map", "[v]", "-map", "[a]",
    "-t", duration.toFixed(3),
    "-r", String(FPS),
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-ac", "2",
    "-movflags", "+faststart",
    destination,
  ]);
  console.log(`Rendered scene ${index + 1}: ${scene.title ?? scene.id ?? path.basename(asset)} (${duration.toFixed(2)}s)`);
}

async function main() {
  ffmpeg = await findTool(ffmpeg, "ffmpeg.exe");
  ffprobe = await findTool(ffprobe, "ffprobe.exe");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const scenes = Array.isArray(manifest) ? manifest : manifest.scenes;
  if (!Array.isArray(scenes) || scenes.length === 0) throw new Error("Manifest must contain a non-empty scenes array.");

  const outputPath = resolveFromManifest(manifest.output?.path ?? manifest.output ?? "out/sim-demo.mp4");
  const voiceoverConfig = typeof manifest.voiceover === "object" ? manifest.voiceover : {};
  const voiceoverDir = resolveFromManifest(voiceoverConfig.directory ?? manifest.voiceoverDir ?? "voiceover");
  const workDir = path.join(path.dirname(outputPath), ".segments");
  const requestedEffects = new Set(scenes.map((scene) => scene.effect).filter(Boolean));
  const effect = manifest.visual_style?.effect_family ?? manifest.entranceEffect ?? [...requestedEffects][0] ?? "slide_up";
  if (!["slide_up", "slide_left", "fade"].includes(effect)) throw new Error(`Unsupported entrance effect: ${effect}`);
  if (requestedEffects.size > 1 || (requestedEffects.size === 1 && !requestedEffects.has(effect))) {
    throw new Error("Use one entrance effect family for the entire video (manifest.entranceEffect).");
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await mkdir(voiceoverDir, { recursive: true });
  await rm(workDir, { recursive: true, force: true });
  await mkdir(workDir, { recursive: true });
  await loadLocalEnv();

  const hasKey = Boolean(process.env.OPENAI_API_KEY);
  if (!hasKey) console.log("OPENAI_API_KEY not found; rendering silent unless cached voiceover files exist.");

  const durations = {};
  const prepared = [];
  for (const [index, scene] of scenes.entries()) {
    const asset = sceneAsset(scene);
    if (!existsSync(asset)) throw new Error(`Missing scene asset: ${asset}`);
    const audioCandidate = voiceoverPath(scene, index, voiceoverDir);
    if (!existsSync(audioCandidate) && hasKey) await generateVoiceover(scene, index, audioCandidate, manifest);
    const audio = existsSync(audioCandidate) ? audioCandidate : null;
    const narrationDuration = audio ? await mediaDuration(audio) : null;
    const explicitDuration = Number(scene.duration);
    let duration = Number.isFinite(explicitDuration) && explicitDuration > 0
      ? explicitDuration
      : narrationDuration !== null
        ? Math.max(narrationDuration + 0.35, MIN_SCENE_DURATION)
        : Number(manifest.defaultDuration ?? DEFAULT_SILENT_DURATION);
    if (index === 0 && !(Number.isFinite(explicitDuration) && explicitDuration > 0)) duration += 0.5;
    if (narrationDuration !== null && duration + 0.001 < narrationDuration) {
      throw new Error(`Scene ${index + 1} duration (${duration}s) is shorter than narration (${narrationDuration.toFixed(3)}s).`);
    }
    const key = `slide_${String(slideNumber(scene, index)).padStart(2, "0")}`;
    durations[key] = {
      audio: narrationDuration === null ? null : Number(narrationDuration.toFixed(3)),
      scene: Number(duration.toFixed(3)),
      source: audio ? path.relative(repoRoot, audio) : "silent",
    };
    const trimStartValue = Number(scene.trim_start ?? scene.capture?.trim_start ?? 0);
    const trimStart = Number.isFinite(trimStartValue) && trimStartValue >= 0 ? trimStartValue : 0;
    prepared.push({ scene, index, asset, type: sceneType(scene, asset), audio, duration, trimStart });
  }
  await writeFile(path.join(voiceoverDir, "durations.json"), `${JSON.stringify(durations, null, 2)}\n`);

  const totalDuration = prepared.reduce((sum, item) => sum + item.duration, 0);
  console.log(`Planned runtime: ${Math.floor(totalDuration / 60)}:${String(Math.round(totalDuration % 60)).padStart(2, "0")}`);
  if (totalDuration > RUNTIME_WARNING_SECONDS) {
    console.warn(`WARNING: planned runtime ${totalDuration.toFixed(1)}s exceeds 2:55.`);
  }

  const segments = [];
  for (const item of prepared) {
    const destination = path.join(workDir, `segment_${String(item.index + 1).padStart(2, "0")}.mp4`);
    await renderSegment({ ...item, effect, destination });
    segments.push(destination);
  }

  const concatPath = path.join(workDir, "concat.txt");
  const concatFile = segments.map((file) => `file '${file.replaceAll("'", "'\\''").replaceAll("\\", "/")}'`).join("\n");
  await writeFile(concatPath, `${concatFile}\n`);
  await run(ffmpeg, [
    "-y", "-f", "concat", "-safe", "0", "-i", concatPath,
    "-c", "copy", "-movflags", "+faststart", outputPath,
  ]);
  console.log(`\nWrote ${path.relative(repoRoot, outputPath)} (${totalDuration.toFixed(1)}s, ${WIDTH}x${HEIGHT}, ${FPS}fps)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
