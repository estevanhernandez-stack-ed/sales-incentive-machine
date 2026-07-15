import { openDatabase } from "../../../../lib/db/client";
import { getSalesCsv } from "../../../../lib/db/sales-data";
export function GET() { const db = openDatabase(); const csv = getSalesCsv(db); db.close(); return new Response(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=sim-sales-export.csv" } }); }
