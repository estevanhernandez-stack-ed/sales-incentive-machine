import { NextResponse } from "next/server";
import { normalizeOpsError } from "./errors";

export function opsErrorResponse(error: unknown) {
  const normalized = normalizeOpsError(error);
  return NextResponse.json({ ok: false, error: { code: normalized.code, message: normalized.message, details: normalized.details } }, { status: normalized.status });
}
