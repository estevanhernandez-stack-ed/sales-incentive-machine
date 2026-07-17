import { NextResponse } from "next/server";
import { openDatabase } from "../../../../../lib/db/client";
import { opsErrorResponse } from "../../../../../lib/ops/http";
import { previewPrizeDrawing } from "../../../../../lib/ops/service";

export async function POST() {
  const db = openDatabase();
  try { return NextResponse.json(previewPrizeDrawing(db)); }
  catch (error) { return opsErrorResponse(error); }
  finally { db.close(); }
}
