import type { RunbookRole } from "../runbooks/types";

export type OperationAction = "record_contest_sales" | "record_bingo_submission" | "record_full_check" | "correct_source_check" | "activate_contest" | "finalize_sales_race" | "award_goal_board" | "draw_prize_winner";

export interface OperationCommand {
  operation_id: string;
  action: OperationAction;
  actor_role: RunbookRole;
  expected_contest_id: number;
  confirm: boolean;
  payload: Record<string, unknown>;
}

export interface OperationEvidence {
  ui_path: string;
  wait_for: string;
  checkpoint_id: string;
}

export interface OperationResponse {
  ok: true;
  operation: {
    operation_id: string;
    action: OperationAction;
    actor_role: RunbookRole;
    status: "applied" | "already_applied";
    contest_id: number;
    created_at: string;
  };
  result: unknown;
  evidence: OperationEvidence;
}

export type OpsErrorCode = "INVALID_REQUEST" | "ROLE_NOT_ALLOWED" | "NOT_FOUND" | "OPERATION_CONFLICT" | "STALE_CONTEST" | "CONFIRMATION_REQUIRED" | "STATE_ALREADY_FINAL" | "NO_QUALIFYING_ENTRIES";
