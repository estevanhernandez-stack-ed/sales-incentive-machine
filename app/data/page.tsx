import { PageHeader } from "../../components/page-header";
import { SalesDataManager } from "../../components/sales-data-manager";
import { openDatabase } from "../../lib/db/client";
import { getSalesDataPageData } from "../../lib/db/sales-data";
export const dynamic = "force-dynamic";
export default async function DataPage({ searchParams }: { searchParams: Promise<{ query?: string; page?: string }> }) { const params = await searchParams; const page = Number(params.page); const db = openDatabase(); const data = getSalesDataPageData(db, { query: params.query, page: Number.isFinite(page) ? page : 1 }); db.close(); return <main className="shell data-shell"><PageHeader current="/data" section="Sales data" title="Sales records" description="Review server performance, enter live sales, and correct source records with an audit trail." meta={<><span>Checks on file</span><strong>{data.totalDatasetChecks.toLocaleString()}</strong></>} /><SalesDataManager key={`${data.query}-${data.page}`} data={data} /></main>; }
