import { NextResponse } from "next/server";
import { openDatabase } from "../../../../../lib/db/client";
import { OpsError } from "../../../../../lib/ops/errors";
import { opsErrorResponse } from "../../../../../lib/ops/http";
import { previewGameFinalization } from "../../../../../lib/ops/service";

export async function POST(request: Request) {
  const db = openDatabase();
  try {
    const body = await request.json() as { game_id?: unknown; gameId?: unknown };
    const gameId = body.game_id ?? body.gameId;
    if (typeof gameId !== "string" || !gameId.trim()) throw new OpsError("INVALID_REQUEST", "game_id is required");
    return NextResponse.json(previewGameFinalization(db, gameId));
  } catch (error) { return opsErrorResponse(error); }
  finally { db.close(); }
}
