import fs from "node:fs";
import path from "node:path";
import { parseArgs, readJson, resolveRunDir } from "./runbook-support.mjs";

export function verifyRun(runId) {
  const runDir = resolveRunDir(runId);
  const requiredFiles = ["run.json", "runbook.json", "scenario.json", "OPERATOR_PROMPT.md", "evidence.json", "observations.json", "operations.json", "summary.json", "review.json", "sim.db"];
  const problems = requiredFiles.filter((name) => !fs.existsSync(path.join(runDir, name))).map((name) => `Missing ${name}`);
  if (problems.length) return { ok: false, problems };

  const evidence = readJson(path.join(runDir, "evidence.json"));
  const operations = readJson(path.join(runDir, "operations.json"));
  const observations = readJson(path.join(runDir, "observations.json"));
  const summary = readJson(path.join(runDir, "summary.json"));
  const blockedRun = summary.status === "blocked";
  const operationIds = new Set((operations.operations ?? []).map((operation) => operation.operation_id));
  for (const checkpoint of evidence.checkpoints ?? []) {
    if (checkpoint.required && checkpoint.result === "pending") problems.push(`Required checkpoint ${checkpoint.checkpoint_id} is pending`);
    else if (checkpoint.required && !blockedRun && checkpoint.result !== "pass") problems.push(`Required checkpoint ${checkpoint.checkpoint_id} is ${checkpoint.result}`);
    else if (checkpoint.required && blockedRun && !(checkpoint.result === "pass" || checkpoint.result === "blocked")) problems.push(`Required checkpoint ${checkpoint.checkpoint_id} must be passed or explicitly blocked`);
    if (checkpoint.result === "blocked" && !checkpoint.operator_note) problems.push(`Blocked checkpoint ${checkpoint.checkpoint_id} needs an operator note`);
    if (checkpoint.result === "pass" && checkpoint.screenshot_path && !fs.existsSync(path.join(runDir, checkpoint.screenshot_path))) problems.push(`Checkpoint ${checkpoint.checkpoint_id} screenshot is missing`);
    if (checkpoint.receipt_required && checkpoint.result === "pass" && !checkpoint.operation_ids?.length) problems.push(`Checkpoint ${checkpoint.checkpoint_id} has no operation receipt`);
    for (const operationId of checkpoint.operation_ids ?? []) if (!operationIds.has(operationId)) problems.push(`Checkpoint ${checkpoint.checkpoint_id} references unknown operation ${operationId}`);
  }
  for (const operation of operations.operations ?? []) if (!(operation.status === "applied" || operation.status === "already_applied")) problems.push(`Operation ${operation.operation_id} is not reconciled`);
  for (const observation of observations.observations ?? []) {
    if (observation.status === "accepted") problems.push(`Observation ${observation.observation_id} was accepted without human triage metadata`);
    if (!observation.step_id || !observation.category || !observation.impact || !observation.suggested_need) problems.push(`Observation ${observation.observation_id ?? "unknown"} is incomplete`);
  }
  if (summary.status !== "complete" && summary.status !== "blocked") problems.push(`Summary status is ${summary.status}`);
  if (!summary.receipt_reconciliation_complete) problems.push("Receipt reconciliation is incomplete");
  if (!summary.evidence_complete) problems.push("Evidence reconciliation is incomplete");
  if (!summary.debrief_complete) problems.push("Debrief is incomplete");
  for (const step of summary.step_results ?? []) if (step.result === "pending") problems.push(`Step ${step.step_id} is pending`);
  if (blockedRun && !(observations.observations ?? []).some((observation) => observation.impact === "blocker")) problems.push("A blocked run needs a blocker observation");
  return { ok: problems.length === 0, problems };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1"))) {
  const args = parseArgs();
  if (!args.run) throw new Error("Provide --run <run-id>");
  const result = verifyRun(args.run);
  if (!result.ok) {
    console.error(`Run ${args.run} is not valid:`);
    result.problems.forEach((problem) => console.error(`- ${problem}`));
    process.exitCode = 1;
  } else {
    console.log(`Run ${args.run} is valid.`);
  }
}
