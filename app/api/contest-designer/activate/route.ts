import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { openDatabase } from "../../../../lib/db/client";
import { validateContestConfig } from "../../../../lib/contest-designer";
import { activateContest } from "../../../../lib/db/contest";

export async function POST(request: Request) { let db; try { const { config, name } = await request.json() as { config?: unknown; name?: unknown }; if (typeof name !== "string" || !name.trim()) throw new Error("Contest name is required"); db = openDatabase(); const ids = new Set((db.prepare("SELECT id FROM menu_items").all() as Array<{ id: number }>).map((item) => item.id)); const valid = validateContestConfig(config, ids); const result = activateContest(db, { name, config: valid }); ["/", "/bingo", "/wheel", "/contest", "/games", "/data"].forEach((path) => revalidatePath(path)); return NextResponse.json({ ok: true, contestId: result.contestId, cardCount: result.cardCount }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not activate config." }, { status: 400 }); } finally { db?.close(); } }
