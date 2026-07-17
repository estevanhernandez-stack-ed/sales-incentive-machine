import { NextResponse } from "next/server";
import { openDatabase } from "../../../../lib/db/client";
import { OpsError } from "../../../../lib/ops/errors";
import { opsErrorResponse } from "../../../../lib/ops/http";
import { listOperationReceipts } from "../../../../lib/ops/service";

export async function GET(request: Request) {
  const db = openDatabase();
  try {
    const url = new URL(request.url);
    const rawLimit = url.searchParams.get("limit");
    const limit = rawLimit === null ? 20 : Number(rawLimit);
    if (!Number.isInteger(limit)) throw new OpsError("INVALID_REQUEST", "limit must be a whole number");
    const rawRole = url.searchParams.get("role");
    const role = rawRole === null ? undefined : rawRole.replaceAll("-", "_");
    if (role !== undefined && role !== "contest_manager" && role !== "shift_manager") throw new OpsError("INVALID_REQUEST", "role must be contest_manager or shift_manager");
    return NextResponse.json({ ok: true, operations: listOperationReceipts(db, { limit, role }) });
  } catch (error) { return opsErrorResponse(error); }
  finally { db.close(); }
}
