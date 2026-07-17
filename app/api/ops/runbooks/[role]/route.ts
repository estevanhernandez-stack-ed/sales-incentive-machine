import { NextResponse } from "next/server";
import { getRunbookByRole } from "../../../../../lib/runbooks/catalog";
import type { RunbookRole } from "../../../../../lib/runbooks/types";
import { OpsError } from "../../../../../lib/ops/errors";
import { opsErrorResponse } from "../../../../../lib/ops/http";

export async function GET(_request: Request, context: { params: Promise<{ role: string }> }) {
  try {
    const { role: rawRole } = await context.params;
    const role = rawRole.replaceAll("-", "_") as RunbookRole;
    if (!(role === "contest_manager" || role === "shift_manager")) throw new OpsError("NOT_FOUND", "Runbook role not found");
    return NextResponse.json({ ok: true, runbook: getRunbookByRole(role) });
  } catch (error) { return opsErrorResponse(error); }
}
