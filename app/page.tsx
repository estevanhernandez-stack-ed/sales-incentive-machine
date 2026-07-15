import { Leaderboard } from "../components/leaderboard";
import { PageHeader } from "../components/page-header";
import { openDatabase } from "../lib/db/client";
import { getDashboardData, type ContestGoal } from "../lib/db/dashboard";

export const dynamic = "force-dynamic";

function goalSummary(goal: ContestGoal) {
  const target = goal.vs_house ? "beat house average" : goal.threshold === undefined ? "qualify" : goal.metric === "alcohol_pct" || goal.metric === "attach_rate" ? `${(goal.threshold * 100).toFixed(0)}%` : goal.metric === "item_count" ? `${goal.threshold} sold` : `$${goal.threshold.toFixed(2)}`;
  if (goal.metric === "ppa") return `PPA · ${target}`;
  if (goal.metric === "alcohol_pct") return `Alcohol sales · ${target}`;
  if (goal.metric === "avg_check") return `Average check · ${target}`;
  if (goal.metric === "large_party_ppa") return `Large-party PPA · ${target}`;
  if (goal.metric === "item_count") return `Item sales · ${target}`;
  return `${goal.category ?? "Item"} attachment · ${target}`;
}

function daysRemaining(weekStart: string) {
  const end = new Date(`${weekStart}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 7);
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86_400_000));
}

export default function Home() {
  const db = openDatabase();
  const dashboard = getDashboardData(db);
  db.close();

  if (!dashboard) return <main className="shell"><h1>No active contest</h1><p className="lede">Seed the local database to start a contest.</p></main>;

  const remaining = daysRemaining(dashboard.contest.weekStart);
  return (
    <main className="shell">
      <PageHeader current="/" section="Manager dashboard" title="Weekly performance" description="Live sales, contest goals, and daily wins for the current team." meta={<><span>Sales view</span><strong>Four weeks</strong></>} />
      <section className="contest-banner" aria-labelledby="contest-name">
        <div><p className="eyebrow">Active contest</p><h2 id="contest-name">{dashboard.contest.name}</h2><p className="prize">Prize: <strong>{dashboard.contest.prize}</strong></p>{dashboard.lastWinner && <p className="last-winner">Last winner: <strong>{dashboard.lastWinner.name}</strong> · {new Date(dashboard.lastWinner.drawnAt).toLocaleDateString()}</p>}</div>
        <div className="time-left"><strong>{remaining}</strong><span>days remaining</span></div>
        <ul className="goal-list">{dashboard.contest.goals.map((goal, index) => <li key={index}>{goalSummary(goal)}</li>)}</ul>
      </section>
      <Leaderboard data={dashboard} />
    </main>
  );
}
