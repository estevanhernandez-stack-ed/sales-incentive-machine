import { NextResponse } from "next/server";
import { openDatabase } from "../../../../lib/db/client";
import { opsErrorResponse } from "../../../../lib/ops/http";
import { getOpsSnapshot } from "../../../../lib/ops/service";

export async function GET() {
  const db = openDatabase();
  try { return NextResponse.json(getOpsSnapshot(db)); }
  catch (error) { return opsErrorResponse(error); }
  finally { db.close(); }
}
