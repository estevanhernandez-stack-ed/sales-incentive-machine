import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { openDatabase } from "../../../../../lib/db/client";
import { rerollBingoCard } from "../../../../../lib/db/bingo";

export async function POST(_: Request, { params }: { params: Promise<{ serverId: string }> }) {
  let db;
  try {
    const { serverId } = await params;
    const id = Number(serverId);
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid server" }, { status: 400 });
    db = openDatabase();
    const grid = rerollBingoCard(db, id);
    revalidatePath("/bingo");
    return NextResponse.json({ grid });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to re-randomize card" }, { status: 400 });
  } finally { db?.close(); }
}
