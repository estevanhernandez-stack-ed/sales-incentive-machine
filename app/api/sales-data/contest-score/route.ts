import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { openDatabase } from "../../../../lib/db/client";
import { addContestScoreEntry } from "../../../../lib/db/sales-data";

export async function POST(request: Request) {
  let db;
  try {
    const body = await request.json() as Parameters<typeof addContestScoreEntry>[1];
    db = openDatabase();
    const result = addContestScoreEntry(db, body);
    ["/", "/data", "/games", "/wheel"].forEach((path) => revalidatePath(path));
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not add contest sales" }, { status: 400 });
  } finally { db?.close(); }
}
