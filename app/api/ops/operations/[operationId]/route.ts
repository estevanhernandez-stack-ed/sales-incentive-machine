import { NextResponse } from "next/server";
import { openDatabase } from "../../../../../lib/db/client";
import { OpsError } from "../../../../../lib/ops/errors";
import { opsErrorResponse } from "../../../../../lib/ops/http";
import { getOperationReceipt } from "../../../../../lib/ops/service";

export async function GET(_request: Request, context: { params: Promise<{ operationId: string }> }) {
  const db = openDatabase();
  try {
    const { operationId } = await context.params;
    const receipt = getOperationReceipt(db, operationId);
    if (!receipt) throw new OpsError("NOT_FOUND", "Operation receipt not found", { operation_id: operationId });
    return NextResponse.json(receipt);
  } catch (error) { return opsErrorResponse(error); }
  finally { db.close(); }
}
