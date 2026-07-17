import { BingoManager } from "../../components/bingo-manager";
import { PageHeader } from "../../components/page-header";
import { openDatabase } from "../../lib/db/client";
import { getBingoPageData } from "../../lib/db/bingo";

export const dynamic = "force-dynamic";

export default async function BingoPage({ searchParams }: { searchParams: Promise<{ server?: string }> }) {
  const params = await searchParams;
  const db = openDatabase();
  const data = getBingoPageData(db);
  db.close();
  if (!data) return <main className="shell"><h1>No active contest</h1><p className="lede">Seed the local database to make bingo cards.</p></main>;
  const requestedServerId = Number(params.server);
  return <main className="shell bingo-shell"><PageHeader current="/bingo" section="Server bingo" title="Bingo cards" description="Print cards, record completed lines, and track daily wins." /><BingoManager data={data} initialServerId={Number.isInteger(requestedServerId) ? requestedServerId : undefined} /></main>;
}
