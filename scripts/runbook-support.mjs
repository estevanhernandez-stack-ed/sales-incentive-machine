import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const runbooksDir = path.join(projectRoot, "runbooks");
export const runsDir = path.join(projectRoot, "artifacts", "runbook-runs");

export function readJson(filename) {
  return JSON.parse(fs.readFileSync(filename, "utf8"));
}

export function writeJson(filename, value) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function readManifest(id) {
  const manifest = readJson(path.join(runbooksDir, `${id}.json`));
  validateManifest(manifest);
  return manifest;
}

export function readScenario(id) {
  const scenario = readJson(path.join(runbooksDir, "scenarios", `${id}.json`));
  const manifest = readManifest(scenario.runbook_id);
  validateScenario(scenario, manifest);
  return { scenario, manifest };
}

export function validateManifest(manifest) {
  if (manifest?.schema_version !== 1 || !manifest.id || !manifest.title || !manifest.purpose) throw new Error("Invalid runbook identity");
  if (!Array.isArray(manifest.steps) || !manifest.steps.length) throw new Error(`Runbook ${manifest.id} has no steps`);
  const prefix = manifest.role === "contest_manager" ? "CM" : manifest.role === "shift_manager" ? "SM" : null;
  if (!prefix) throw new Error(`Runbook ${manifest.id} has an invalid role`);
  const checkpoints = new Set();
  manifest.steps.forEach((step, index) => {
    const expected = `${prefix}-${String(index + 1).padStart(2, "0")}`;
    if (step.id !== expected) throw new Error(`Expected ${expected}, received ${step.id}`);
    if (!step.title || !step.instruction || !step.expected?.length || !step.observations?.length || !step.recovery?.length) throw new Error(`Step ${step.id} is incomplete`);
    for (const evidence of step.evidence ?? []) {
      if (checkpoints.has(evidence.id)) throw new Error(`Duplicate evidence ID ${evidence.id}`);
      if (!evidence.ui_path?.startsWith("/") || !evidence.capture_name?.endsWith(".png")) throw new Error(`Invalid evidence ${evidence.id}`);
      checkpoints.add(evidence.id);
    }
  });
  return manifest;
}

export function validateScenario(scenario, manifest) {
  if (scenario?.schema_version !== 1 || !scenario.id || scenario.role !== manifest.role || scenario.runbook_id !== manifest.id) throw new Error("Scenario identity or role is invalid");
  const stepIds = new Set(manifest.steps.map((step) => step.id));
  if (!scenario.required_steps?.length || !scenario.assignments?.length || !scenario.success_conditions?.length) throw new Error(`Scenario ${scenario.id} is incomplete`);
  for (const id of scenario.required_steps) if (!stepIds.has(id)) throw new Error(`Scenario ${scenario.id} requires unknown step ${id}`);
  return scenario;
}

export function parseArgs(argv = process.argv.slice(2)) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const [rawKey, inlineValue] = token.slice(2).split("=", 2);
    const next = argv[index + 1];
    result[rawKey] = inlineValue ?? (next && !next.startsWith("--") ? (index += 1, next) : true);
  }
  return result;
}

export function makeRunId(scenarioId, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `${stamp}-${scenarioId}-${crypto.randomBytes(3).toString("hex")}`;
}

export function resolveRunDir(runId) {
  if (!/^[a-zA-Z0-9._-]+$/.test(runId)) throw new Error("Run ID may contain only letters, numbers, dots, underscores, and hyphens");
  const resolved = path.resolve(runsDir, runId);
  if (path.dirname(resolved) !== path.resolve(runsDir)) throw new Error("Run path must remain inside artifacts/runbook-runs");
  return resolved;
}

export function renderList(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

export function renderOperatorPrompt({ manifest, scenario, runId, runDir, baseUrl }) {
  const base = fs.readFileSync(path.join(projectRoot, "agents", "runbooks", "base-operator.md"), "utf8").trim();
  const roleFile = manifest.role === "contest_manager" ? "contest-manager-operator.md" : "shift-manager-operator.md";
  const role = fs.readFileSync(path.join(projectRoot, "agents", "runbooks", roleFile), "utf8").trim();
  const assignments = renderList(scenario.assignments);
  const conditions = renderList(scenario.success_conditions);
  return `${base}\n\n${role}\n\n# Assigned run\n\n- Run ID: ${runId}\n- Scenario: ${scenario.title} (${scenario.id})\n- Role: ${manifest.role}\n- Base URL: ${baseUrl}\n- Writable artifact directory: ${runDir}\n- Disposable database: ${path.join(runDir, "sim.db")}\n\n## Assignments\n\n${assignments}\n\n## Success conditions\n\n${conditions}\n\nThe complete canonical manifest and scenario are copied beside this prompt. Follow their stable step and checkpoint IDs exactly.\n`;
}
