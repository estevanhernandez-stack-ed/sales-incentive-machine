import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { openDatabase } from "../../../../../lib/db/client";
import { awardMenuMission } from "../../../../../lib/db/games";
export async function POST(request: Request) { let db; try { const { gameId } = await request.json() as { gameId?: unknown }; if (typeof gameId !== "string") throw new Error("Invalid game"); db = openDatabase(); const serverIds = awardMenuMission(db, gameId); ["/games", "/wheel"].forEach((path) => revalidatePath(path)); return NextResponse.json({ serverIds }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not award mission" }, { status: 400 }); } finally { db?.close(); } }
