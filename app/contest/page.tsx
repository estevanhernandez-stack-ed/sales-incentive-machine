import { ContestBuilder } from "../../components/contest-designer";
import { PageHeader } from "../../components/page-header";
import { openDatabase } from "../../lib/db/client";
import { getContestSetupData } from "../../lib/db/contest";

export const dynamic = "force-dynamic";

export default function ContestPage() {
  const db = openDatabase();
  const data = getContestSetupData(db);
  db.close();
  if (!data) return <main className="shell"><h1>No active contest</h1><p className="lede">Seed the local database to create a contest.</p></main>;
  return <main className="shell contest-shell"><PageHeader current="/contest" section="Contest setup" title="Build the next sales contest" description="Set the goals, prize, scoring, and live gameboards your team will use." /><ContestBuilder initialName={data.name} initialConfig={data.config} menuItems={data.menuItems} /></main>;
}
