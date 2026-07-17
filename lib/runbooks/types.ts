export type RunbookRole = "contest_manager" | "shift_manager";
export type RunbookPhase = "preflight" | "setup" | "live" | "finalize" | "evidence" | "debrief";
export type RunbookMode = "read" | "ui_write" | "api_write" | "decision" | "debrief";
export type StepResult = "pending" | "pass" | "fail" | "blocked" | "skipped";

export interface RunbookEvidenceDefinition {
  id: string;
  required: boolean;
  ui_path: string;
  wait_for: string;
  capture_name: string;
  receipt_required: boolean;
}

export interface RunbookStep {
  id: string;
  phase: RunbookPhase;
  title: string;
  instruction: string;
  mode: RunbookMode;
  preconditions: string[];
  expected: string[];
  confirmation: "none" | "explicit";
  allowed_tools: string[];
  forbidden_shortcuts: string[];
  evidence: RunbookEvidenceDefinition[];
  observations: string[];
  recovery: string[];
}

export interface RunbookManifest {
  schema_version: 1;
  id: string;
  title: string;
  role: RunbookRole;
  purpose: string;
  authority: { allowed: string[]; forbidden: string[] };
  steps: RunbookStep[];
}

export interface RunbookScenario {
  schema_version: 1;
  id: string;
  title: string;
  role: RunbookRole;
  runbook_id: string;
  purpose: string;
  starting_state: string[];
  fixtures: Record<string, unknown>;
  assignments: string[];
  required_steps: string[];
  success_conditions: string[];
  intentional_discoveries: string[];
}
