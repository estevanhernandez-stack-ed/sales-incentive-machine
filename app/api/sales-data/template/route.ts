import { salesTemplateHeaders } from "../../../../lib/db/sales-data";
export function GET() { return new Response(`${salesTemplateHeaders.join(",")}\n`, { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=sim-sales-import-template.csv" } }); }
