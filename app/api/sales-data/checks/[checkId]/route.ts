import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { openDatabase } from "../../../../../lib/db/client";
import { correctSalesCheck } from "../../../../../lib/db/sales-data";

export async function PUT(request: Request, { params }: { params: Promise<{ checkId: string }> }) {
  let db;
  try {
    const { checkId } = await params;
    const body = await request.json();
    db = openDatabase();
    const id = correctSalesCheck(db, { ...body, checkId: Number(checkId) });
    ["/", "/wheel", "/data", "/games"].forEach((path) => revalidatePath(path));
    return NextResponse.json({ id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not correct this check" }, { status: 400 });
  } finally { db?.close(); }
}
