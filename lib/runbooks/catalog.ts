import contestManagerJson from "../../runbooks/contest-manager.json";
import shiftManagerJson from "../../runbooks/shift-manager.json";
import managerItemContestJson from "../../runbooks/scenarios/manager-item-contest.json";
import managerLateInformationJson from "../../runbooks/scenarios/manager-late-information.json";
import shiftErrorRecoveryJson from "../../runbooks/scenarios/shift-error-recovery.json";
import shiftLiveEntryJson from "../../runbooks/scenarios/shift-live-entry.json";
import type { RunbookManifest, RunbookRole, RunbookScenario } from "./types";

const phases = new Set(["preflight", "setup", "live", "finalize", "evidence", "debrief"]);
const modes = new Set(["read", "ui_write", "api_write", "decision", "debrief"]);

export function validateRunbook(value: unknown): RunbookManifest {
  if (!value || typeof value !== "object") throw new Error("Runbook must be an object");
  const runbook = value as RunbookManifest;
  if (runbook.schema_version !== 1) throw new Error("Runbook schema_version must be 1");
  if (!runbook.id || !runbook.title || !runbook.purpose) throw new Error("Runbook identity fields are required");
  if (!(["contest_manager", "shift_manager"] as string[]).includes(runbook.role)) throw new Error("Unknown runbook role");
  if (!runbook.authority?.allowed?.length || !runbook.authority?.forbidden?.length) throw new Error("Runbook authority must be explicit");
  if (!Array.isArray(runbook.steps) || runbook.steps.length === 0) throw new Error("Runbook must contain steps");

  const stepIds = new Set<string>();
  const evidenceIds = new Set<string>();
  const captureNames = new Set<string>();
  const expectedPrefix = runbook.role === "contest_manager" ? "CM" : "SM";
  runbook.steps.forEach((step, index) => {
    const expectedId = `${expectedPrefix}-${String(index + 1).padStart(2, "0")}`;
    if (step.id !== expectedId) throw new Error(`Expected step ${expectedId}, received ${step.id}`);
    if (stepIds.has(step.id)) throw new Error(`Duplicate step ID ${step.id}`);
    stepIds.add(step.id);
    if (!phases.has(step.phase) || !modes.has(step.mode)) throw new Error(`Invalid phase or mode on ${step.id}`);
    if (!step.title || !step.instruction || !step.expected?.length || !step.observations?.length || !step.recovery?.length) throw new Error(`Incomplete step ${step.id}`);
    if (!(step.confirmation === "none" || step.confirmation === "explicit")) throw new Error(`Invalid confirmation on ${step.id}`);
    for (const checkpoint of step.evidence ?? []) {
      if (evidenceIds.has(checkpoint.id)) throw new Error(`Duplicate checkpoint ID ${checkpoint.id}`);
      if (captureNames.has(checkpoint.capture_name)) throw new Error(`Duplicate capture name ${checkpoint.capture_name}`);
      if (!checkpoint.ui_path.startsWith("/") || !checkpoint.capture_name.endsWith(".png")) throw new Error(`Invalid checkpoint ${checkpoint.id}`);
      evidenceIds.add(checkpoint.id);
      captureNames.add(checkpoint.capture_name);
    }
  });
  return runbook;
}

export function validateScenario(value: unknown, manifests: RunbookManifest[] = runbooks): RunbookScenario {
  if (!value || typeof value !== "object") throw new Error("Scenario must be an object");
  const scenario = value as RunbookScenario;
  if (scenario.schema_version !== 1 || !scenario.id || !scenario.title || !scenario.purpose) throw new Error("Scenario identity is invalid");
  const manifest = manifests.find((candidate) => candidate.id === scenario.runbook_id);
  if (!manifest) throw new Error(`Scenario ${scenario.id} names an unknown runbook`);
  if (manifest.role !== scenario.role) throw new Error(`Scenario ${scenario.id} role does not match its runbook`);
  if (!scenario.starting_state?.length || !scenario.assignments?.length || !scenario.required_steps?.length || !scenario.success_conditions?.length) throw new Error(`Scenario ${scenario.id} is incomplete`);
  const availableSteps = new Set(manifest.steps.map((step) => step.id));
  for (const stepId of scenario.required_steps) {
    if (!availableSteps.has(stepId)) throw new Error(`Scenario ${scenario.id} requires unknown step ${stepId}`);
  }
  return scenario;
}

const runbooks = [validateRunbook(contestManagerJson), validateRunbook(shiftManagerJson)];
const scenarios = [managerItemContestJson, managerLateInformationJson, shiftErrorRecoveryJson, shiftLiveEntryJson].map((scenario) => validateScenario(scenario, runbooks));

export function getRunbookByRole(role: RunbookRole) {
  const runbook = runbooks.find((candidate) => candidate.role === role);
  if (!runbook) throw new Error(`No runbook for role ${role}`);
  return runbook;
}

export function getRunbookById(id: string) {
  return runbooks.find((candidate) => candidate.id === id) ?? null;
}

export function getScenarioById(id: string) {
  return scenarios.find((candidate) => candidate.id === id) ?? null;
}

export function listRunbooks() {
  return [...runbooks];
}

export function listScenarios() {
  return [...scenarios];
}
