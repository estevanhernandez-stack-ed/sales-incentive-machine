import { PageHeader } from "../../components/page-header";
import { PrizeWheel } from "../../components/prize-wheel";
import { openDatabase } from "../../lib/db/client";
import { getWheelData } from "../../lib/db/wheel";

export const dynamic = "force-dynamic";

export default async function WheelPage({ searchParams }: { searchParams: Promise<{ server?: string }> }) {
  const params = await searchParams;
  const db = openDatabase();
  const data = getWheelData(db);
  db.close();
  if (!data) return <main className="shell"><h1>No active contest</h1><p className="lede">Seed the local database to run a drawing.</p></main>;
  const requestedServerId = Number(params.server);
  return <main className="shell wheel-shell"><PageHeader current="/wheel" section="Prize drawing" title={data.contest.name} description="Review the field, present the contenders, then run the weekly drawing." meta={<><span>Prize</span><strong>{data.contest.prize}</strong></>} /><PrizeWheel data={data} initialServerId={Number.isInteger(requestedServerId) ? requestedServerId : undefined} /><section className="drawing-history"><p className="eyebrow">Drawing history</p><h2>Past winners</h2>{data.history.length ? <ul>{data.history.map((drawing) => <li key={drawing.id}><strong>{drawing.winnerName}</strong><span>{drawing.contestName} · {new Date(drawing.drawnAt).toLocaleDateString()}</span></li>)}</ul> : <p>No winners yet.</p>}</section></main>;
}
