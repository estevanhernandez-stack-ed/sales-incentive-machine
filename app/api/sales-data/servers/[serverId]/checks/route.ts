import { NextResponse } from "next/server";
import { openDatabase } from "../../../../../../lib/db/client";
import { getServerChecks } from "../../../../../../lib/db/sales-data";

export async function GET(request: Request, { params }: { params: Promise<{ serverId: string }> }) {
  let db;
  try {
    const { serverId } = await params;
    const page = Number(new URL(request.url).searchParams.get("page") ?? "1");
    db = openDatabase();
    return NextResponse.json(getServerChecks(db, Number(serverId), Number.isFinite(page) ? page : 1));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load server checks" }, { status: 400 });
  } finally { db?.close(); }
}
