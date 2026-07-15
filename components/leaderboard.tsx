"use client";

import { useMemo, useState } from "react";
import type { ContestGoal, DashboardData } from "../lib/db/dashboard";

function formatValue(value: number, metricId: string) {
  if (metricId.startsWith("alcohol_pct") || metricId.startsWith("attach_rate")) return `${(value * 100).toFixed(1)}%`;
  if (metricId.startsWith("item_count")) return value.toLocaleString();
  return `$${value.toFixed(2)}`;
}

function goalLabel(goal: ContestGoal, index: number) {
  if (goal.metric === "ppa") return "PPA";
  if (goal.metric === "alcohol_pct") return "Alcohol";
  if (goal.metric === "avg_check") return "Check avg";
  if (goal.metric === "large_party_ppa") return "Large party";
  if (goal.metric === "item_count") return "Item sales";
  return `${goal.category ?? "Item"} attach ${index + 1}`;
}

export function Leaderboard({ data }: { data: DashboardData }) {
  const [metricId, setMetricId] = useState(data.metrics[0]?.id ?? "");
  const selectedMetric = data.metrics.find((metric) => metric.id === metricId) ?? data.metrics[0];
  const rows = useMemo(
    () => [...data.leaderboard].sort((a, b) => b.values[metricId] - a.values[metricId]),
    [data.leaderboard, metricId],
  );

  if (!selectedMetric) return null;
  const houseValue = data.houseValues[metricId];

  return (
    <section className="leaderboard-panel" aria-labelledby="leaderboard-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Performance board</p>
          <h2 id="leaderboard-heading">The week at a glance</h2>
        </div>
        <label className="metric-picker">
          <span className="sr-only">Leaderboard metric</span>
          <select value={metricId} onChange={(event) => setMetricId(event.target.value)}>
            {data.metrics.map((metric) => <option key={metric.id} value={metric.id}>{metric.label}</option>)}
          </select>
        </label>
      </div>
      <div className="house-average">House average: <strong>{formatValue(houseValue, metricId)}</strong></div>
      <div className="board-table-wrap">
        <table>
          <thead><tr><th>Server</th><th>{selectedMetric.label}</th><th>vs. house</th><th>Goals</th><th>Daily wins</th></tr></thead>
          <tbody>
            {rows.map((server, index) => {
              const value = server.values[metricId];
              const delta = value - houseValue;
              return <tr key={server.id}>
                <td><span className="rank">{index + 1}</span><span className="avatar" style={{ backgroundColor: server.color }}>{server.name.slice(0, 1)}</span><strong>{server.name}</strong>{server.edited && <span className="edited-tag">Edited</span>}</td>
                <td className="metric-value">{formatValue(value, metricId)}</td>
                <td className={delta > 0 ? "positive" : "negative"}>{delta > 0 ? "+" : ""}{formatValue(delta, metricId)}</td>
                <td><div className="badges">{data.contest.goals.map((goal, goalIndex) => <span className={server.qualifications[goalIndex] ? "badge qualified" : "badge"} key={`${server.id}-${goalIndex}`}>{server.qualifications[goalIndex] ? "✓ " : ""}{goalLabel(goal, goalIndex)}</span>)}</div></td>
                <td><span className="wins">{server.dailyWins}</span></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
