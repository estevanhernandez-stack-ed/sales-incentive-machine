import fs from "node:fs";
import path from "node:path";
import { makeRunId, parseArgs, projectRoot, readScenario, renderOperatorPrompt, resolveRunDir, writeJson } from "./runbook-support.mjs";

export function scaffoldRun({ scenarioId, requestedRunId, baseUrl = "http://127.0.0.1:3100", now = new Date() }) {
  if (!scenarioId) throw new Error("Provide --scenario <scenario-id>");
  const { scenario, manifest } = readScenario(scenarioId);
  const runId = requestedRunId || makeRunId(scenario.id, now);
  const runDir = resolveRunDir(runId);
  if (fs.existsSync(runDir)) throw new Error(`Run ${runId} already exists`);
  const sourceDatabase = path.join(projectRoot, "data", "sim.db");
  if (!fs.existsSync(sourceDatabase)) throw new Error("data/sim.db is missing. Run npm run seed first.");

  fs.mkdirSync(path.join(runDir, "screenshots"), { recursive: true });
  fs.copyFileSync(sourceDatabase, path.join(runDir, "sim.db"));
  fs.copyFileSync(path.join(projectRoot, "runbooks", `${manifest.id}.json`), path.join(runDir, "runbook.json"));
  fs.copyFileSync(path.join(projectRoot, "runbooks", "scenarios", `${scenario.id}.json`), path.join(runDir, "scenario.json"));

  const createdAt = now.toISOString();
  const requiredStepIds = new Set(scenario.required_steps);
  const selectedSteps = manifest.steps.filter((step) => requiredStepIds.has(step.id));
  const evidence = selectedSteps.flatMap((step) => step.evidence.filter((item) => item.required).map((item) => ({
    checkpoint_id: item.id,
    step_id: step.id,
    required: true,
    result: "pending",
    captured_at: null,
    ui_path: item.ui_path,
    wait_for: item.wait_for,
    screenshot_path: `screenshots/${item.capture_name}`,
    operation_ids: [],
    receipt_required: item.receipt_required,
    operator_note: ""
  })));
  const run = { schema_version: 1, run_id: runId, scenario_id: scenario.id, runbook_id: manifest.id, role: manifest.role, status: "scaffolded", created_at: createdAt, started_at: null, completed_at: null, base_url: baseUrl, database_path: path.join(runDir, "sim.db"), artifact_directory: runDir };
  const summary = { schema_version: 1, run_id: runId, status: "in_progress", outcome: "", step_results: selectedSteps.map((step) => ({ step_id: step.id, result: "pending", note: "" })), receipt_reconciliation_complete: false, evidence_complete: false, debrief_complete: false, unresolved_items: [], proposed_needs: [] };
  writeJson(path.join(runDir, "run.json"), run);
  writeJson(path.join(runDir, "evidence.json"), { schema_version: 1, run_id: runId, checkpoints: evidence });
  writeJson(path.join(runDir, "observations.json"), { schema_version: 1, run_id: runId, observations: [] });
  writeJson(path.join(runDir, "operations.json"), { schema_version: 1, run_id: runId, operations: [] });
  writeJson(path.join(runDir, "summary.json"), summary);
  writeJson(path.join(runDir, "review.json"), { schema_version: 1, run_id: runId, status: "pending", verdict: null, findings: [] });
  fs.writeFileSync(path.join(runDir, "OPERATOR_PROMPT.md"), renderOperatorPrompt({ manifest, scenario, runId, runDir, baseUrl }), "utf8");
  fs.writeFileSync(path.join(runDir, "RUN.md"), `# SIM run ${runId}\n\n- Scenario: ${scenario.title}\n- Role: ${manifest.role}\n- Status: scaffolded\n- Disposable database: \`sim.db\`\n- Base URL: ${baseUrl}\n\n## Start\n\n\`npm run runbook:serve -- --run ${runId} --port ${new URL(baseUrl).port || "3100"}\`\n\n## Verify\n\n\`npm run runbook:verify -- --run ${runId}\`\n\nAll operator and reviewer writes must remain inside this directory.\n`, "utf8");
  return { runId, runDir, evidenceCount: evidence.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1"))) {
  const args = parseArgs();
  const result = scaffoldRun({ scenarioId: args.scenario, requestedRunId: args.run, baseUrl: args.url });
  console.log(`Scaffolded ${result.runId}`);
  console.log(`Artifacts: ${result.runDir}`);
  console.log(`Required checkpoints: ${result.evidenceCount}`);
}
