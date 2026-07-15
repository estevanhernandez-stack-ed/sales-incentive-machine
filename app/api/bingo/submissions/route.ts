import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { openDatabase } from "../../../../lib/db/client";
import { recordBingoSubmission } from "../../../../lib/db/bingo";

export async function POST(request: Request) {
  let db;
  try {
    const body = await request.json() as { cardId?: unknown; markedCells?: unknown };
    if (!Number.isInteger(body.cardId)) return NextResponse.json({ error: "Invalid card" }, { status: 400 });
    db = openDatabase();
    const submission = recordBingoSubmission(db, body.cardId as number, body.markedCells);
    revalidatePath("/"); revalidatePath("/bingo");
    return NextResponse.json(submission);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to log card" }, { status: 400 });
  } finally { db?.close(); }
}
