import type { OpsErrorCode } from "./types";

const statuses: Record<OpsErrorCode, number> = {
  INVALID_REQUEST: 400,
  ROLE_NOT_ALLOWED: 403,
  NOT_FOUND: 404,
  OPERATION_CONFLICT: 409,
  STALE_CONTEST: 409,
  CONFIRMATION_REQUIRED: 409,
  STATE_ALREADY_FINAL: 409,
  NO_QUALIFYING_ENTRIES: 422,
};

export class OpsError extends Error {
  constructor(public code: OpsErrorCode, message: string, public details: Record<string, unknown> = {}) {
    super(message);
    this.name = "OpsError";
  }
  get status() { return statuses[this.code]; }
}

export function normalizeOpsError(error: unknown) {
  if (error instanceof OpsError) return error;
  const message = error instanceof Error ? error.message : "The operation could not be completed";
  if (/already (drawn|closed|locked)|drawing is already closed/i.test(message)) return new OpsError("STATE_ALREADY_FINAL", message);
  if (/qualifying entry/i.test(message)) return new OpsError("NO_QUALIFYING_ENTRIES", message);
  if (/not found|no active contest|not part of the active contest/i.test(message)) return new OpsError("NOT_FOUND", message);
  return new OpsError("INVALID_REQUEST", message);
}
