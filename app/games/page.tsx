import { PageHeader } from "../../components/page-header";
import { GameHub } from "../../components/game-hub";
import { openDatabase } from "../../lib/db/client";
import { getGamesData } from "../../lib/db/games";
export const dynamic = "force-dynamic";
export default function GamesPage() { const db = openDatabase(); const data = getGamesData(db); db.close(); return <main className="shell games-shell"><PageHeader current="/games" section="Sales games" title="Gameboards" description="Live standings and goal progress from the sales recorded for this contest." />{data?.games.length ? <GameHub data={data} /> : <p className="lede">Add games in Contest setup to start a board.</p>}</main>; }
