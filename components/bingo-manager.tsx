"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BingoPageData } from "../lib/db/bingo";

const winningLines = [
  [0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20, 21, 22, 23, 24],
  [0, 5, 10, 15, 20], [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24],
  [0, 6, 12, 18, 24], [4, 8, 12, 16, 20],
];

type LineGesture = {
  pointerId: number;
  start: number;
  line: number[] | null;
  intent: "mark" | "clear";
  initial: Set<number>;
};

export function BingoManager({ data }: { data: BingoPageData }) {
  const router = useRouter();
  const [serverId, setServerId] = useState(data.cards[0]?.serverId ?? 0);
  const [marked, setMarked] = useState<Set<number>>(new Set([12]));
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const gesture = useRef<LineGesture | null>(null);
  const card = data.cards.find((candidate) => candidate.serverId === serverId) ?? data.cards[0];

  useEffect(() => { setMarked(new Set([12])); setMessage(""); }, [serverId]);
  if (!card) return null;

  function toggleCell(index: number) {
    if (index === 12) return;
    setMarked((current) => {
      const next = new Set(current);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  }

  function previewGesture(index: number) {
    const current = gesture.current;
    if (!current || index === 12) return;
    if (index !== current.start && !current.line) {
      current.line = winningLines.find((line) => line.includes(current.start) && line.includes(index)) ?? null;
      if (!current.line) return;
    }
    const line = current.line;
    if (line && !line.includes(index)) return;
    const segment = line
      ? line.slice(Math.min(line.indexOf(current.start), line.indexOf(index)), Math.max(line.indexOf(current.start), line.indexOf(index)) + 1)
      : [current.start];
    const next = new Set(current.initial);
    segment.forEach((cell) => {
      if (cell === 12) return;
      current.intent === "mark" ? next.add(cell) : next.delete(cell);
    });
    next.add(12);
    setMarked(next);
  }

  function startGesture(index: number, event: React.PointerEvent<HTMLButtonElement>) {
    if (index === 12 || saving) return;
    event.preventDefault();
    const grid = event.currentTarget.closest(".bingo-grid") as HTMLElement | null;
    grid?.setPointerCapture(event.pointerId);
    gesture.current = { pointerId: event.pointerId, start: index, line: null, intent: marked.has(index) ? "clear" : "mark", initial: new Set(marked) };
    previewGesture(index);
  }

  function moveGesture(event: React.PointerEvent<HTMLDivElement>) {
    if (!gesture.current || gesture.current.pointerId !== event.pointerId) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-bingo-index]");
    const index = Number(target?.dataset.bingoIndex);
    if (Number.isInteger(index)) previewGesture(index);
  }

  function endGesture(event: React.PointerEvent<HTMLDivElement>) {
    if (gesture.current?.pointerId !== event.pointerId) return;
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  async function reroll() {
    setSaving(true); setMessage("");
    const response = await fetch(`/api/bingo/cards/${card.serverId}`, { method: "POST" });
    setSaving(false);
    if (!response.ok) { setMessage("Could not re-randomize this card."); return; }
    setMarked(new Set([12])); setMessage("Fresh card ready to print."); router.refresh();
  }

  async function submit() {
    setSaving(true); setMessage("");
    const response = await fetch("/api/bingo/submissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId: card.id, markedCells: [...marked] }) });
    const result = await response.json().catch(() => null) as { dailyWin?: boolean; linesCompleted?: number; entriesAwarded?: number } | null;
    setSaving(false);
    if (!response.ok || !result) { setMessage("Could not log this card."); return; }
    setMessage(result.dailyWin ? `Daily win logged — ${result.linesCompleted} line${result.linesCompleted === 1 ? "" : "s"} complete${result.entriesAwarded ? `, ${result.entriesAwarded} wheel entr${result.entriesAwarded === 1 ? "y" : "ies"} added` : ""}.` : "Card logged — no completed line yet.");
    setMarked(new Set([12])); router.refresh();
  }

  return <section className="bingo-workspace">
    <aside className="server-picker no-print"><p className="eyebrow">Pick a server</p><div>{data.cards.map((candidate) => <button className={candidate.serverId === card.serverId ? "server-button selected" : "server-button"} onClick={() => setServerId(candidate.serverId)} key={candidate.id}><span className="avatar" style={{ backgroundColor: candidate.serverColor }}>{candidate.serverName.slice(0, 1)}</span>{candidate.serverName}<span>{data.dailyWins[candidate.serverId] ?? 0} wins</span></button>)}</div></aside>
    <div className="card-area">
      <div className="bingo-card-heading"><div><p className="eyebrow">{data.contest.name}</p><h2>{card.serverName}&rsquo;s card</h2><p>{data.contest.weekStart} week</p></div><div className="bingo-actions no-print"><button className="button secondary" disabled={saving} onClick={reroll}>Re-randomize</button><button className="button" onClick={() => window.print()}>Print card</button></div></div>
      <p className="bingo-gesture-note no-print">Click a square or drag across a row, column, or diagonal. Off-line squares are ignored while you drag.</p>
      <div className="bingo-grid" aria-label={`${card.serverName} bingo card`} onPointerMove={moveGesture} onPointerUp={endGesture} onPointerCancel={endGesture}>{card.grid.map((cell, index) => <button className={cell === "FREE" ? "bingo-cell free" : marked.has(index) ? "bingo-cell marked" : "bingo-cell"} data-bingo-index={index} disabled={cell === "FREE" || saving} onPointerDown={(event) => startGesture(index, event)} onClick={(event) => { if (event.detail === 0) toggleCell(index); }} key={index}><span>{cell === "FREE" ? "FREE" : data.itemNames[cell]}</span>{cell !== "FREE" && <small>{marked.has(index) ? "Marked" : "Tap or drag"}</small>}</button>)}</div>
      <div className="submission-bar no-print"><div><strong>{data.dailyWins[card.serverId] ?? 0}</strong> daily wins so far</div><button className="button" disabled={saving} onClick={submit}>Log turned-in card</button></div>
      {message && <p className="bingo-message no-print" role="status">{message}</p>}
    </div>
  </section>;
}
