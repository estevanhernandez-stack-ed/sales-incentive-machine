import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { openDatabase } from "../../../../lib/db/client";
import { addManualSalesEntry } from "../../../../lib/db/sales-data";
export async function POST(request: Request) { let db; try { const body = await request.json() as Parameters<typeof addManualSalesEntry>[1]; db = openDatabase(); const id = addManualSalesEntry(db, body); ["/", "/wheel", "/data", "/games"].forEach((path) => revalidatePath(path)); return NextResponse.json({ id }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save this check" }, { status: 400 }); } finally { db?.close(); } }
