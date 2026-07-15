import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { openDatabase } from "../../../../lib/db/client";
import { importSalesCsv } from "../../../../lib/db/sales-data";
export async function POST(request: Request) { let db; try { const { fileName, csv } = await request.json() as { fileName?: unknown; csv?: unknown }; if (typeof fileName !== "string" || typeof csv !== "string") throw new Error("Upload a CSV file"); db = openDatabase(); const result = importSalesCsv(db, fileName, csv); ["/", "/bingo", "/wheel", "/data"].forEach((path) => revalidatePath(path)); return NextResponse.json(result); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Import failed" }, { status: 400 }); } finally { db?.close(); } }
