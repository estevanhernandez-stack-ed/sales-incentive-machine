import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { openDatabase } from "../../../../lib/db/client";
import { opsErrorResponse } from "../../../../lib/ops/http";
import { executeOperation } from "../../../../lib/ops/service";

const pathsByAction: Record<string, string[]> = {
  record_contest_sales: ["/", "/data", "/games", "/wheel"],
  record_bingo_submission: ["/", "/bingo", "/wheel"],
  record_full_check: ["/", "/data", "/games", "/wheel"],
  correct_source_check: ["/", "/data", "/games", "/wheel"],
  activate_contest: ["/", "/contest", "/data", "/bingo", "/games", "/wheel"],
  finalize_sales_race: ["/games", "/wheel"],
  award_goal_board: ["/games", "/wheel"],
  draw_prize_winner: ["/", "/bingo", "/wheel"],
};

export async function POST(request: Request) {
  const db = openDatabase();
  try {
    const response = executeOperation(db, await request.json());
    for (const path of pathsByAction[response.operation.action] ?? []) revalidatePath(path);
    return NextResponse.json(response);
  } catch (error) { return opsErrorResponse(error); }
  finally { db.close(); }
}
