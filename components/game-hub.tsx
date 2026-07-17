"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { getGamesData } from "../lib/db/games";

type Data = NonNullable<ReturnType<typeof getGamesData>>;

function value(value: number, metric: string) {
  return metric === "item_count" ? value.toLocaleString() : metric === "attach_rate" || metric === "alcohol_pct" ? `${(value * 100).toFixed(1)}%` : `$${value.toFixed(2)}`;
}

export function GameHub({ data, focusGameId }: { data: Data; focusGameId?: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const pendingOperations = useRef(new Map<string, string>());

  useEffect(() => {
    if (focusGameId && data.games.some((game) => game.id === focusGameId)) document.getElementById(`game-${focusGameId}`)?.scrollIntoView({ block: "center" });
  }, [focusGameId, data.games]);

  async function act(action: "finalize_sales_race" | "award_goal_board", gameId: string) {
    const verb = action === "finalize_sales_race" ? "lock these final race standings" : "award every currently eligible server";
    if (!window.confirm(`Confirm: ${verb}. This award cannot be edited afterward.`)) return;
    setBusy(gameId);
    const operationId = pendingOperations.current.get(gameId) ?? `ui-manager-${action}-${crypto.randomUUID()}`;
    pendingOperations.current.set(gameId, operationId);
    try {
      const response = await fetch("/api/ops/commands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation_id: operationId, action, actor_role: "contest_manager", expected_contest_id: data.contestId, confirm: true, payload: { gameId } }) });
      const result = await response.json().catch(() => null) as { operation?: { operation_id?: string }; error?: { message?: string } } | null;
      setBusy(""); pendingOperations.current.delete(gameId);
      setMessage(response.ok ? `Awards locked from live sales data. Receipt ${result?.operation?.operation_id}.` : result?.error?.message ?? "Could not award this game.");
      if (response.ok) router.refresh();
    } catch {
      setBusy("");
      setMessage("Connection interrupted. Try again to reconcile the same award receipt.");
    }
  }

  return <section className="games-grid">
    <div className="game-toolbar no-print"><span><strong>{data.games.length} live board{data.games.length === 1 ? "" : "s"}</strong><small>Standings update when sales records change.</small></span><div><Link className="button secondary" href="/contest">Edit game setup</Link><button className="button secondary" onClick={() => window.print()}>Print boards</button></div></div>
    {data.games.map((game) => game.type === "sales_race" ? <article className={focusGameId === game.id ? "game-card race evidence-focus" : "game-card race"} id={`game-${game.id}`} key={game.id}>
      <div className="game-card-heading"><div><p className="eyebrow">Featured sales race</p><h2>{game.title}</h2><p>Ranked by {game.metricLabel.toLowerCase()}. Top finishers earn {game.entries_by_place.join(" / ")} wheel entries.</p></div>{game.awards.length ? <span className="locked">Final</span> : <span className="live-status">Live</span>}</div>
      <div className="game-standings-table board-table-wrap"><table><thead><tr><th>Place</th><th>Server</th><th>{game.metricLabel}</th><th>Wheel entries</th></tr></thead><tbody>{game.standings.map((server, index) => <tr className={index < game.entries_by_place.length ? "in-the-money" : ""} key={server.id}><td><strong>{index + 1}</strong></td><td><span className="avatar" style={{ backgroundColor: server.color }}>{server.name.slice(0, 1)}</span><strong>{server.name}</strong></td><td className="metric-value">{value(server.value, game.metric.metric)}</td><td>{game.awards.find((award) => award.server_id === server.id)?.entries_awarded ?? (index < game.entries_by_place.length ? game.entries_by_place[index] : "—")}</td></tr>)}</tbody></table></div>
      {!game.awards.length && <button className="button no-print" disabled={busy === game.id} onClick={() => act("finalize_sales_race", game.id)}>Lock final standings & award entries</button>}
    </article> : <article className={focusGameId === game.id ? "game-card mission evidence-focus" : "game-card mission"} id={`game-${game.id}`} key={game.id}>
      <div className="game-card-heading"><div><p className="eyebrow">Contest goal board</p><h2>{game.title}</h2><p>Complete every goal to earn {game.entries_on_completion} wheel entries.</p></div>{game.awards.length ? <span className="locked">{game.awards.length} awarded</span> : <span className="live-status">Live</span>}</div>
      <div className="mission-table board-table-wrap"><table><thead><tr><th>Server</th>{game.objectiveLabels.map((label) => <th key={label}>{label}</th>)}<th>Progress</th><th>Entries</th></tr></thead><tbody>{game.standings.map((server) => { const completed = server.objectives.filter((objective) => objective.complete).length; const award = game.awards.find((entry) => entry.server_id === server.id); return <tr key={server.id}><td><span className="avatar" style={{ backgroundColor: server.color }}>{server.name.slice(0, 1)}</span><strong>{server.name}</strong></td>{server.objectives.map((objective, index) => <td className={objective.complete ? "goal-cell complete" : "goal-cell"} key={`${server.id}-${index}`}><strong>{value(objective.value, objective.metric)}</strong><small>{objective.complete ? "Met" : "In progress"}</small></td>)}<td><strong>{completed}/{server.objectives.length}</strong></td><td>{award?.entries_awarded ?? (completed === server.objectives.length ? game.entries_on_completion : "—")}</td></tr>; })}</tbody></table></div>
      {!game.awards.length && <button className="button no-print" disabled={busy === game.id} onClick={() => act("award_goal_board", game.id)}>Award servers who completed the board</button>}
    </article>)}
    {message && <p className="designer-message no-print" role="status">{message}</p>}
  </section>;
}
