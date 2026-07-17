"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { WheelData } from "../lib/db/wheel";

const sliceColors = ["var(--wheel-1)", "var(--wheel-2)", "var(--wheel-3)", "var(--wheel-4)", "var(--wheel-5)", "var(--wheel-6)"];

function wheelGradient(entries: WheelData["entries"]) {
  const active = entries.filter((entry) => entry.entries > 0);
  const total = active.reduce((sum, entry) => sum + entry.entries, 0);
  if (!total) return "#453a30";
  let position = 0;
  return `conic-gradient(${active.map((entry, index) => { const next = position + (entry.entries / total) * 360; const result = `${sliceColors[index % sliceColors.length]} ${position}deg ${next}deg`; position = next; return result; }).join(", ")})`;
}

function targetRotation(entries: WheelData["entries"], winnerId: number) {
  const active = entries.filter((entry) => entry.entries > 0);
  const total = active.reduce((sum, entry) => sum + entry.entries, 0);
  let position = 0;
  for (const entry of active) {
    const arc = (entry.entries / total) * 360;
    if (entry.serverId === winnerId) return 360 * 5 + (360 - (position + arc / 2));
    position += arc;
  }
  return 360 * 5;
}

function sliceCenters(entries: WheelData["entries"]) {
  const active = entries.filter((entry) => entry.entries > 0);
  const total = active.reduce((sum, entry) => sum + entry.entries, 0);
  let position = 0;
  return active.map((entry) => { const arc = (entry.entries / total) * 360; const center = position + arc / 2; position += arc; return { ...entry, center }; });
}

export function PrizeWheel({ data, initialServerId }: { data: WheelData; initialServerId?: number }) {
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [winnerName, setWinnerName] = useState<string | null>(data.currentDrawing?.winnerName ?? null);
  const [expandedServerId, setExpandedServerId] = useState<number | null>(data.entries.some((entry) => entry.serverId === initialServerId) ? initialServerId as number : null);
  const drawingOperation = useRef<string | null>(null);
  const activeEntries = data.entries.filter((entry) => entry.entries > 0);
  const gradient = useMemo(() => wheelGradient(data.entries), [data.entries]);
  const labels = useMemo(() => sliceCenters(data.entries), [data.entries]);

  async function spin() {
    if (spinning || data.currentDrawing) return;
    if (!window.confirm(`Draw one winner for ${data.contest.prize}? The winner and entry field cannot be changed afterward.`)) return;
    setSpinning(true);
    const operationId = drawingOperation.current ?? `ui-manager-draw-${crypto.randomUUID()}`;
    drawingOperation.current = operationId;
    try {
      const response = await fetch("/api/ops/commands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation_id: operationId, action: "draw_prize_winner", actor_role: "contest_manager", expected_contest_id: data.contest.id, confirm: true, payload: {} }) });
      const result = await response.json().catch(() => null) as { result?: { winner?: { serverId: number; name: string } }; error?: { message?: string } } | null;
      if (!response.ok || !result?.result?.winner) { drawingOperation.current = null; setWinnerName(result?.error?.message ?? "Unable to spin the wheel."); setSpinning(false); return; }
      drawingOperation.current = null;
      const winner = result.result.winner;
      setRotation(rotation + targetRotation(data.entries, winner.serverId));
      window.setTimeout(() => { setWinnerName(winner.name); setSpinning(false); router.refresh(); }, 5000);
    } catch {
      setWinnerName("Connection interrupted. Retry to reconcile the same drawing receipt.");
      setSpinning(false);
    }
  }

  return <section className="wheel-layout">
    <div className="wheel-stage"><div className="wheel-pointer" aria-hidden="true" /><div className="wheel" style={{ background: gradient, transform: `rotate(${rotation}deg)` }}>{labels.map((entry) => <span className="wheel-slice-label" style={{ transform: `translate(-50%, -50%) rotate(${entry.center}deg) translateY(calc(-1 * var(--wheel-label-radius))) rotate(${-entry.center - rotation}deg)` }} key={entry.serverId}>{entry.name}</span>)}<div className="wheel-hub">SIM</div></div>{winnerName && <div className="winner-banner"><p className="eyebrow">Winner</p><strong>{winnerName}</strong></div>}</div>
    <aside className="entry-panel"><p className="eyebrow">{data.currentDrawing ? "Drawing complete" : "Live entries"}</p><h2>{data.currentDrawing ? `${data.currentDrawing.winnerName} takes it.` : "Contender field"}</h2><p className="wheel-prize">Select a server to review their performance before the drawing.</p><div className="entry-list">{data.entries.map((entry) => {
      const expanded = expandedServerId === entry.serverId;
      return <article className={entry.entries ? "entry-row" : "entry-row no-entries"} key={entry.serverId}>
        <button className="entry-summary" aria-expanded={expanded} onClick={() => setExpandedServerId(expanded ? null : entry.serverId)}>
          <span className="avatar" style={{ backgroundColor: entry.color }}>{entry.name.slice(0, 1)}</span><span><strong>{entry.name}</strong><small>{entry.goalsMet} goals · {entry.dailyWins} daily wins</small></span><b>{entry.entries}</b><span className="entry-chevron" aria-hidden="true">⌄</span>
        </button>
        {expanded && <div className="entry-details">
          <div className="entry-breakdown"><span><small>Goal entries</small><strong>{entry.entryBreakdown.goals}</strong></span><span><small>Bingo entries</small><strong>{entry.entryBreakdown.bingo}</strong></span><span><small>Game entries</small><strong>{entry.entryBreakdown.games}</strong></span></div>
          <dl className="server-stat-grid"><div><dt>PPA</dt><dd>${entry.performance.ppa.toFixed(2)}</dd></div><div><dt>Avg check</dt><dd>${entry.performance.avgCheck.toFixed(2)}</dd></div><div><dt>Alcohol</dt><dd>{(entry.performance.alcoholPct * 100).toFixed(1)}%</dd></div><div><dt>App attach</dt><dd>{(entry.performance.appetizerAttach * 100).toFixed(1)}%</dd></div><div><dt>Dessert attach</dt><dd>{(entry.performance.dessertAttach * 100).toFixed(1)}%</dd></div></dl>
          <div className="entry-goals">{entry.goalStats.map((goal, index) => <div className={goal.qualified ? "entry-goal qualified" : "entry-goal"} key={`${entry.serverId}-${index}`}><span>{goal.label}<small>Target: {goal.target}</small></span><strong>{goal.metric === "alcohol_pct" || goal.metric === "attach_rate" ? `${(goal.value * 100).toFixed(1)}%` : goal.metric === "item_count" ? goal.value.toLocaleString() : `$${goal.value.toFixed(2)}`}</strong></div>)}</div>
        </div>}
      </article>;
    })}</div>{!data.currentDrawing && <button className="spin-button" disabled={spinning || !activeEntries.length} onClick={spin}>{spinning ? "Spinning…" : "Spin the prize wheel"}</button>}<button className="tv-button" onClick={() => document.documentElement.requestFullscreen?.()}>Enter TV mode</button></aside>
  </section>;
}
