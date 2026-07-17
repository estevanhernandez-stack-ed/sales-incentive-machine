import { NextResponse } from "next/server";
import { openDatabase } from "../../../../../lib/db/client";
import { opsErrorResponse } from "../../../../../lib/ops/http";
import { previewContest } from "../../../../../lib/ops/service";

export async function POST(request: Request) {
  const db = openDatabase();
  try { return NextResponse.json(previewContest(db, await request.json())); }
  catch (error) { return opsErrorResponse(error); }
  finally { db.close(); }
}
