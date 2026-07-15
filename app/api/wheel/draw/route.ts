import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { openDatabase } from "../../../../lib/db/client";
import { drawWheel } from "../../../../lib/db/wheel";

export async function POST() {
  let db;
  try {
    db = openDatabase();
    const drawing = drawWheel(db);
    revalidatePath("/"); revalidatePath("/bingo"); revalidatePath("/wheel");
    return NextResponse.json(drawing);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to draw winner" }, { status: 400 });
  } finally { db?.close(); }
}
