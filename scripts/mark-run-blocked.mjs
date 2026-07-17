import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { parseArgs, readJson, resolveRunDir, writeJson } from "./runbook-support.mjs";

export async function markRunBlocked({ runId, reason, category = "evidence_gap", baseUrl }) {
  if (!runId || !reason) throw new Error("Provide --run <run-id> and --reason <text>");
  const runDir = resolveRunDir(runId);
  const runPath = path.join(runDir, "run.json");
  if (!fs.existsSync(runPath)) throw new Error(`Run ${runId} does not exist`);
  const run = readJson(runPath);
  const evidence = readJson(path.join(runDir, "evidence.json"));
  const summary = readJson(path.join(runDir, "summary.json"));
  const now = new Date().toISOString();
  evidence.checkpoints = (evidence.checkpoints ?? []).map((checkpoint) => checkpoint.result === "pending" ? { ...checkpoint, result: "blocked", captured_at: now, screenshot_path: null, operator_note: reason } : checkpoint);

  let receiptOperations = [];
  if (baseUrl) {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/ops/operations?limit=100`);
    if (!response.ok) throw new Error(`Could not reconcile operations from ${baseUrl}`);
    const payload = await response.json();
    receiptOperations = (payload.operations ?? []).map((receipt) => ({ operation_id: receipt.operation.operation_id, action: receipt.operation.action, actor_role: receipt.operation.actor_role, status: receipt.operation.status, contest_id: receipt.operation.contest_id, created_at: receipt.operation.created_at, receipt }));
  } else {
    const db = new Database(path.join(runDir, "sim.db"), { readonly: true });
    try {
      const rows = db.prepare("SELECT response_json FROM operation_receipts ORDER BY created_at DESC").all();
      receiptOperations = rows.map((row) => {
        const receipt = JSON.parse(row.response_json);
        return { operation_id: receipt.operation.operation_id, action: receipt.operation.action, actor_role: receipt.operation.actor_role, status: receipt.operation.status, contest_id: receipt.operation.contest_id, created_at: receipt.operation.created_at, receipt };
      });
    } finally { db.close(); }
  }

  const observation = {
    observation_id: `${runId}-blocker-01`,
    step_id: summary.step_results?.[0]?.step_id ?? "RUN",
    category,
    expected: "The assigned operator can reach the disposable local UI and capture required checkpoints.",
    observed: reason,
    workaround: null,
    impact: "blocker",
    evidence_ids: evidence.checkpoints.map((checkpoint) => checkpoint.checkpoint_id),
    operation_ids: receiptOperations.map((operation) => operation.operation_id),
    suggested_need: "Provide an approved local browser connection, then repeat the role run without changing product source.",
    confidence: "high",
    status: "candidate"
  };
  summary.status = "blocked";
  summary.outcome = reason;
  summary.step_results = (summary.step_results ?? []).map((step) => step.result === "pending" ? { ...step, result: "blocked", note: reason } : step);
  summary.receipt_reconciliation_complete = true;
  summary.evidence_complete = true;
  summary.debrief_complete = true;
  summary.unresolved_items = [reason];
  summary.proposed_needs = [observation.suggested_need];
  run.status = "blocked";
  run.completed_at = now;
  writeJson(runPath, run);
  writeJson(path.join(runDir, "evidence.json"), evidence);
  writeJson(path.join(runDir, "operations.json"), { schema_version: 1, run_id: runId, operations: receiptOperations });
  writeJson(path.join(runDir, "observations.json"), { schema_version: 1, run_id: runId, observations: [observation] });
  writeJson(path.join(runDir, "summary.json"), summary);
  return { runId, receiptCount: receiptOperations.length, blockedCheckpoints: evidence.checkpoints.filter((checkpoint) => checkpoint.result === "blocked").length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1"))) {
  const args = parseArgs();
  const result = await markRunBlocked({ runId: args.run, reason: args.reason, category: args.category, baseUrl: args.url });
  console.log(`Marked ${result.runId} blocked with ${result.receiptCount} reconciled receipts and ${result.blockedCheckpoints} blocked checkpoints.`);
}
