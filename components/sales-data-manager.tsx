"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import type { getSalesDataPageData } from "../lib/db/sales-data";

type Data = ReturnType<typeof getSalesDataPageData>;
type Check = Data["recentChecks"][number];
type ItemLine = { menuItemId: string; qty: string; priceEach: string };
type ServerPanel = { serverId: number; mode: "contest" | "checks" };
type EditorOrigin =
  | { kind: "server-check"; serverId: number; checkId: number }
  | { kind: "table-check"; checkId: number }
  | { kind: "live-entry" };
type ServerChecksPage = { page: number; pageCount: number; pageSize: number; totalChecks: number; checks: Check[] };

function localDateTime(value: string) { return value.slice(0, 16); }
function linesFor(check: Check): ItemLine[] { return check.items.map((item) => ({ menuItemId: String(item.menu_item_id), qty: String(item.qty), priceEach: String(item.price_each) })); }
function itemTotal(items: ItemLine[]) { return items.reduce((total, item) => total + Number(item.qty || 0) * Number(item.priceEach || 0), 0); }
function formatMetric(value: number, metricId: string) { if (metricId.startsWith("item_count")) return value.toLocaleString(); return metricId.includes("_pct") || metricId.startsWith("attach_rate") ? `${(value * 100).toFixed(1)}%` : `$${value.toFixed(2)}`; }
function originKey(origin: EditorOrigin | null) { if (!origin) return ""; if (origin.kind === "server-check") return `${origin.kind}:${origin.serverId}:${origin.checkId}`; if (origin.kind === "table-check") return `${origin.kind}:${origin.checkId}`; return origin.kind; }

export function SalesDataManager({ data }: { data: Data }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [search, setSearch] = useState(data.query);
  const [serverPanel, setServerPanel] = useState<ServerPanel | null>(null);
  const [serverChecks, setServerChecks] = useState<Record<number, ServerChecksPage>>({});
  const [checksBusy, setChecksBusy] = useState<number | null>(null);
  const [checksError, setChecksError] = useState<Record<number, string>>({});
  const [contestTargetId, setContestTargetId] = useState(String(data.contestSales?.targets[0]?.menuItemId ?? ""));
  const [contestQuantity, setContestQuantity] = useState("1");
  const [contestMessage, setContestMessage] = useState("");
  const [contestBusy, setContestBusy] = useState(false);
  const [editorOrigin, setEditorOrigin] = useState<EditorOrigin | null>(null);
  const [selected, setSelected] = useState<Check | null>(null);
  const [newCheck, setNewCheck] = useState(false);
  const [serverId, setServerId] = useState("");
  const [openedAt, setOpenedAt] = useState("");
  const [partySize, setPartySize] = useState("");
  const [subtotal, setSubtotal] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<ItemLine[]>([]);
  const serverColumnCount = data.performanceMetrics.length + 4;

  function clearEditor() {
    setSelected(null);
    setNewCheck(false);
    setEditorOrigin(null);
    setMessage("");
  }

  function cancelEditor() {
    clearEditor();
  }

  function chooseCheck(check: Check, origin: EditorOrigin) {
    setNewCheck(false);
    setSelected(check);
    setEditorOrigin(origin);
    setServerId(String(check.server_id));
    setOpenedAt(localDateTime(check.opened_at));
    setPartySize(String(check.party_size));
    setSubtotal(String(check.subtotal));
    setNote(check.note);
    setItems(linesFor(check));
    setMessage("");
  }

  function startNewCheck(forServerId: number | undefined, origin: EditorOrigin) {
    setSelected(null);
    setNewCheck(true);
    setEditorOrigin(origin);
    setServerId(String(forServerId ?? data.servers[0]?.id ?? ""));
    setOpenedAt(new Date().toISOString().slice(0, 16));
    setPartySize("1");
    setSubtotal("0");
    setNote("Live manager entry");
    setItems([]);
    setMessage("");
  }

  function toggleContestEntry(serverId: number) {
    if (serverPanel?.serverId === serverId && serverPanel.mode === "contest") {
      setServerPanel(null);
      setContestMessage("");
      return;
    }
    clearEditor();
    setServerPanel({ serverId, mode: "contest" });
    setContestTargetId(String(data.contestSales?.targets[0]?.menuItemId ?? ""));
    setContestQuantity("1");
    setContestMessage("");
  }

  async function loadServerChecks(serverId: number, page = 1) {
    setChecksBusy(serverId);
    setChecksError((current) => ({ ...current, [serverId]: "" }));
    const response = await fetch(`/api/sales-data/servers/${serverId}/checks?page=${page}`);
    const result = await response.json().catch(() => null) as (ServerChecksPage & { error?: string }) | null;
    setChecksBusy(null);
    if (!response.ok || !result) {
      setChecksError((current) => ({ ...current, [serverId]: result?.error ?? "Could not load this server's checks." }));
      return;
    }
    setServerChecks((current) => ({ ...current, [serverId]: result }));
  }

  function toggleServerChecks(serverId: number) {
    if (serverPanel?.serverId === serverId && serverPanel.mode === "checks") {
      setServerPanel(null);
      clearEditor();
      return;
    }
    clearEditor();
    setContestMessage("");
    setServerPanel({ serverId, mode: "checks" });
    if (!serverChecks[serverId]) void loadServerChecks(serverId);
  }

  function toggleTableCheck(check: Check) {
    if (editorOrigin?.kind === "table-check" && editorOrigin.checkId === check.id) {
      clearEditor();
      return;
    }
    setServerPanel(null);
    setContestMessage("");
    chooseCheck(check, { kind: "table-check", checkId: check.id });
  }

  function toggleLiveEntry() {
    if (editorOrigin?.kind === "live-entry") {
      clearEditor();
      return;
    }
    setServerPanel(null);
    setContestMessage("");
    startNewCheck(data.servers[0]?.id, { kind: "live-entry" });
  }

  function changeItems(update: (current: ItemLine[]) => ItemLine[]) { const next = update(items); setItems(next); if (next.length) setSubtotal(itemTotal(next).toFixed(2)); }
  function updateItem(index: number, field: keyof ItemLine, value: string) { changeItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item)); }
  function chooseItem(index: number, menuItemId: string) { const menuItem = data.menuItems.find((menu) => menu.id === Number(menuItemId)); changeItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, menuItemId, priceEach: String(menuItem?.price ?? item.priceEach) } : item)); }
  function addItem() { changeItems((current) => [...current, { menuItemId: String(data.menuItems[0]?.id ?? ""), qty: "1", priceEach: String(data.menuItems[0]?.price ?? "0") }]); }
  function removeItem(index: number) { changeItems((current) => current.filter((_, itemIndex) => itemIndex !== index)); }
  function pageHref(page: number) { const params = new URLSearchParams(); if (data.query) params.set("query", data.query); params.set("page", String(page)); return `/data?${params}`; }

  async function upload() {
    if (!file) return;
    setBusy(true);
    setUploadMessage("");
    const csv = await file.text();
    const response = await fetch("/api/sales-data/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.name, csv }) });
    const result = await response.json().catch(() => null) as { importedChecks?: number; error?: string } | null;
    setBusy(false);
    setUploadMessage(response.ok ? `Imported ${result?.importedChecks} checks from ${file.name}.` : result?.error ?? "Import failed.");
    if (response.ok) router.refresh();
  }

  async function saveCheck() {
    if (!selected && !newCheck) return;
    setBusy(true);
    setMessage("");
    const response = await fetch(selected ? `/api/sales-data/checks/${selected.id}` : "/api/sales-data/manual", { method: selected ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serverId: Number(serverId), openedAt: new Date(openedAt).toISOString(), partySize: Number(partySize), subtotal: Number(subtotal), note, items: items.map((item) => ({ menuItemId: Number(item.menuItemId), qty: Number(item.qty), priceEach: Number(item.priceEach) })) }) });
    const result = await response.json().catch(() => null) as { error?: string } | null;
    setBusy(false);
    setMessage(response.ok ? selected ? `Check #${selected.id} corrected and marked Edited.` : "New sales entry saved." : result?.error ?? "Could not save this check.");
    if (response.ok) {
      const origin = editorOrigin;
      setSelected(null);
      setNewCheck(false);
      router.refresh();
      if (origin?.kind === "server-check") void loadServerChecks(origin.serverId, serverChecks[origin.serverId]?.page ?? 1);
    }
  }

  async function saveContestSales(serverId: number) {
    const quantity = Number(contestQuantity);
    const target = data.contestSales?.targets.find((item) => item.menuItemId === Number(contestTargetId));
    if (!target) return;
    setContestBusy(true);
    setContestMessage("");
    const response = await fetch("/api/sales-data/contest-score", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serverId, menuItemId: target.menuItemId, quantity }) });
    const result = await response.json().catch(() => null) as { error?: string } | null;
    setContestBusy(false);
    setContestMessage(response.ok ? `Added ${quantity} ${target.name} sale${quantity === 1 ? "" : "s"} to the live contest.` : result?.error ?? "Could not add contest sales.");
    if (response.ok) { setContestQuantity("1"); router.refresh(); }
  }

  const editor = (selected || newCheck) && <div className="inline-editor">
    <div className="inline-editor-heading">
      <div><p className="eyebrow">{selected ? `Correct check #${selected.id}` : "New sales entry"}</p><h3>{selected ? "Correct the source record" : "Add live sales"}</h3><p>{selected ? "The previous values and reason are retained in correction history." : "Item detail immediately updates item and attachment gameboards."}</p></div>
      <button className="text-button" type="button" onClick={cancelEditor}>Close</button>
    </div>
    <div className="inline-editor-fields">
      <label>Server<select value={serverId} onChange={(event) => setServerId(event.target.value)}>{data.servers.map((server) => <option value={server.id} key={server.id}>{server.name}</option>)}</select></label>
      <label>Opened at<input type="datetime-local" value={openedAt} onChange={(event) => setOpenedAt(event.target.value)} /></label>
      <label>Party size<input type="number" min="1" value={partySize} onChange={(event) => setPartySize(event.target.value)} /></label>
      <label>{items.length ? "Subtotal (calculated)" : "Subtotal"}<input type="number" min="0" step="0.01" readOnly={items.length > 0} value={subtotal} onChange={(event) => setSubtotal(event.target.value)} /></label>
    </div>
    <label>{selected ? "Reason for correction" : "Entry note"}<input value={note} onChange={(event) => setNote(event.target.value)} placeholder={selected ? "Why was this changed?" : "Why is this being entered manually?"} /></label>
    <div className="item-editor">
      <div className="item-editor-heading"><h3>Items sold</h3><button className="button secondary" type="button" onClick={addItem}>Add item</button></div>
      {items.length ? items.map((item, index) => <div className="item-line" key={`${index}-${item.menuItemId}`}>
        <select aria-label={`Item ${index + 1}`} value={item.menuItemId} onChange={(event) => chooseItem(index, event.target.value)}>{data.menuItems.map((menuItem) => <option value={menuItem.id} key={menuItem.id}>{menuItem.name}</option>)}</select>
        <input type="number" min="1" step="1" value={item.qty} aria-label="Quantity" onChange={(event) => updateItem(index, "qty", event.target.value)} />
        <input type="number" min="0" step="0.01" value={item.priceEach} aria-label="Price each" onChange={(event) => updateItem(index, "priceEach", event.target.value)} />
        <button className="button secondary" type="button" onClick={() => removeItem(index)}>Remove</button>
      </div>) : <p className="empty-items">No item detail yet. Add menu items to support item-based games and metrics.</p>}
    </div>
    <div className="designer-actions"><button className="button" disabled={busy} type="button" onClick={saveCheck}>{selected ? "Save corrected check" : "Save sales entry"}</button><button className="button secondary" disabled={busy} type="button" onClick={cancelEditor}>Cancel</button></div>
    {message && <p className="inline-tool-message" role="status">{message}</p>}
  </div>;

  function originContent(origin: EditorOrigin) {
    const isOrigin = originKey(editorOrigin) === originKey(origin);
    if (!isOrigin) return null;
    return editor ?? (message && <p className="inline-tool-message" role="status">{message}</p>);
  }

  function contestEntry(serverId: number, serverName: string) {
    const targets = data.contestSales?.targets ?? [];
    const target = targets.find((item) => item.menuItemId === Number(contestTargetId)) ?? targets[0];
    const parsedQuantity = Number(contestQuantity);
    const validQuantity = Number.isInteger(parsedQuantity) && parsedQuantity >= 1 && parsedQuantity <= 999;
    const quantity = validQuantity ? parsedQuantity : 0;
    const stepQuantity = validQuantity ? parsedQuantity : 1;
    const recentEntries = data.contestSales?.entries.filter((entry) => entry.server_id === serverId) ?? [];
    if (!data.contestSales || !target) return <div className="contest-quick-entry"><p className="empty-items">The active contest has no item-count target to enter here.</p></div>;
    return <div className="contest-quick-entry">
      <div className="inline-editor-heading"><div><p className="eyebrow">Live contest tally</p><h3>Add sales for {serverName}</h3><p>This changes {data.contestSales.contestName} standings only. It does not create a check or alter check-based metrics.</p></div><button className="text-button" type="button" onClick={() => { setServerPanel(null); setContestMessage(""); }}>Close</button></div>
      <div className="contest-entry-controls">
        <label>Contest item{targets.length > 1 ? <select value={target.menuItemId} onChange={(event) => setContestTargetId(event.target.value)}>{targets.map((item) => <option key={item.menuItemId} value={item.menuItemId}>{item.name}</option>)}</select> : <strong className="contest-target">{target.name}</strong>}</label>
        <label>Quantity<div className="quantity-stepper"><button type="button" aria-label="Decrease quantity" disabled={!validQuantity || stepQuantity <= 1} onClick={() => setContestQuantity(String(stepQuantity - 1))}>−</button><input type="number" min="1" max="999" step="1" value={contestQuantity} onChange={(event) => setContestQuantity(event.target.value)} /><button type="button" aria-label="Increase quantity" disabled={stepQuantity >= 999} onClick={() => setContestQuantity(String(stepQuantity + 1))}>+</button></div></label>
        <div className="contest-entry-total"><small>Automatic total</small><strong>{quantity} sale{quantity === 1 ? "" : "s"}</strong><span>${(quantity * target.price).toFixed(2)} menu value</span></div>
        <button className="button" type="button" disabled={contestBusy || !validQuantity} onClick={() => saveContestSales(serverId)}>Add to live standings</button>
      </div>
      {contestMessage && <p className="inline-tool-message" role="status">{contestMessage}</p>}
      {recentEntries.length > 0 && <div className="contest-entry-log"><p className="eyebrow">Recent manual contest entries</p><ul>{recentEntries.map((entry) => <li key={entry.id}><span><strong>+{entry.quantity} {entry.menu_item_name}</strong><small>{new Date(entry.entered_at).toLocaleString()}</small></span><span>Logged</span></li>)}</ul></div>}
    </div>;
  }

  return <section className="data-workspace">
    <section className="server-performance-panel">
      <div className="data-table-heading"><div><p className="eyebrow">Server performance</p><h2>Live scores by server</h2><p>Add active contest sales or inspect source checks without leaving the server row.</p></div></div>
      <div className="board-table-wrap"><table className="server-performance-table">
        <thead><tr><th>Server</th>{data.performanceMetrics.map((metric) => <th key={metric.id}>{metric.label}</th>)}<th>Goals</th><th>Daily wins</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{data.serverPerformance.map((server) => {
          const panelOpen = serverPanel?.serverId === server.id;
          const checksPage = serverChecks[server.id];
          const checks = checksPage?.checks ?? [];
          return <Fragment key={server.id}>
            <tr className={panelOpen ? "source-row expanded" : "source-row"}>
              <td><span className="avatar" style={{ backgroundColor: server.color }}>{server.name.slice(0, 1)}</span><strong>{server.name}</strong>{server.edited && <span className="edited-tag">Edited</span>}</td>
              {data.performanceMetrics.map((metric) => <td className="metric-value" key={`${server.id}-${metric.id}`}>{formatMetric(server.values[metric.id], metric.id)}</td>)}
              <td><strong>{server.qualifications.filter(Boolean).length}/{data.contestGoalCount}</strong></td><td><span className="wins">{server.dailyWins}</span></td>
              <td><div className="table-actions"><button className="button small" disabled={!data.contestSales?.targets.length} aria-expanded={panelOpen && serverPanel.mode === "contest"} aria-controls={`server-tools-${server.id}`} onClick={() => toggleContestEntry(server.id)}>Add contest sales</button><button className="text-button" aria-expanded={panelOpen && serverPanel.mode === "checks"} aria-controls={`server-tools-${server.id}`} onClick={() => toggleServerChecks(server.id)}>Checks</button></div></td>
            </tr>
            {panelOpen && <tr className="inline-tool-row"><td colSpan={serverColumnCount}><div className="inline-tool" id={`server-tools-${server.id}`}>
              {serverPanel.mode === "contest" ? contestEntry(server.id, server.name) : <div className="inline-checks">
                <div className="inline-checks-heading"><div><p className="eyebrow">Checks</p><h3>{server.name}</h3></div>{checksPage && <span>{checksPage.totalChecks.toLocaleString()} checks · page {checksPage.page} of {checksPage.pageCount}</span>}</div>
                {checksBusy === server.id && !checksPage ? <p className="inline-loading">Loading checks…</p> : checksError[server.id] ? <p className="inline-tool-message error" role="alert">{checksError[server.id]}</p> : checks.length ? checks.map((check) => <div className="inline-check" key={check.id}>
                  <div className="inline-check-summary"><span><strong>#{check.id}</strong><small>{new Date(check.opened_at).toLocaleString()}</small></span><span><small>Party</small><strong>{check.party_size}</strong></span><span><small>Subtotal</small><strong>${check.subtotal.toFixed(2)}</strong></span><span><small>Items</small><strong>{check.is_itemized ? check.item_rows : "—"}</strong></span><span className={`source-tag ${check.source_type}`}>{check.source_type}</span><button className="button table-action" aria-expanded={editorOrigin?.kind === "server-check" && editorOrigin.checkId === check.id} onClick={() => editorOrigin?.kind === "server-check" && editorOrigin.checkId === check.id ? clearEditor() : chooseCheck(check, { kind: "server-check", serverId: server.id, checkId: check.id })}>Edit</button></div>
                  {originContent({ kind: "server-check", serverId: server.id, checkId: check.id })}
                </div>) : <p className="empty-items">No checks have been recorded for this server.</p>}
                {checksPage && checksPage.pageCount > 1 && <div className="inline-pagination"><span>Showing {(checksPage.page - 1) * checksPage.pageSize + 1}–{Math.min(checksPage.page * checksPage.pageSize, checksPage.totalChecks)} of {checksPage.totalChecks.toLocaleString()}</span><div><button className="button secondary" disabled={checksBusy === server.id || checksPage.page <= 1} onClick={() => loadServerChecks(server.id, checksPage.page - 1)}>Previous</button><button className="button secondary" disabled={checksBusy === server.id || checksPage.page >= checksPage.pageCount} onClick={() => loadServerChecks(server.id, checksPage.page + 1)}>Next</button></div></div>}
              </div>}
            </div></td></tr>}
          </Fragment>;
        })}</tbody>
      </table></div>
    </section>

    <div className="data-card"><p className="eyebrow">Import a sheet</p><h2>Bring in sales rows.</h2><p>Export a CSV from Excel or Google Sheets, match the template columns, then import it here. Add item rows when you want item-based games and metrics.</p><a className="button secondary" href="/api/sales-data/template">Download CSV template</a><input type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><button className="button" disabled={!file || busy} onClick={upload}>Import sales CSV</button>{uploadMessage && <p className="inline-tool-message" role="status">{uploadMessage}</p>}</div>
    <div className={editorOrigin?.kind === "live-entry" ? "data-card live-entry-card expanded" : "data-card live-entry-card"}><p className="eyebrow">Full check entry</p><h2>Record a complete check</h2><p>Use this only when you have the party, item lines, and complete check total. Item lines calculate the subtotal automatically.</p><button className="button" aria-expanded={editorOrigin?.kind === "live-entry"} onClick={toggleLiveEntry}>Add full check</button>{originContent({ kind: "live-entry" })}</div>
    <div className="data-card data-history"><p className="eyebrow">Data history</p><a href="/api/sales-data/export">Export current sales CSV</a><p><strong>{data.manualCount}</strong> corrected checks in the active dataset.</p>{data.imports.length ? <ul>{data.imports.map((entry) => <li key={`${entry.file_name}-${entry.imported_at}`}>{entry.file_name} · {entry.row_count} rows</li>)}</ul> : <p>No imported sheets yet.</p>}</div>

    <section className="current-data-table">
      <div className="data-table-heading"><div><p className="eyebrow">Current sales data</p><h2>{data.totalChecks.toLocaleString()} matching checks</h2><p>Edit a check directly beneath its source row.</p></div><form className="data-search" onSubmit={(event) => { event.preventDefault(); const params = new URLSearchParams(); if (search.trim()) params.set("query", search.trim()); params.set("page", "1"); router.push(`/data?${params}`); }}><label className="sr-only" htmlFor="sales-search">Search current sales</label><input id="sales-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search check, server, item, or note" /><button className="button" type="submit">Search</button></form></div>
      <div className="board-table-wrap"><table><thead><tr><th>When</th><th>Server</th><th>Party</th><th>Subtotal</th><th>Items</th><th>Source</th><th>Note</th><th><span className="sr-only">Edit</span></th></tr></thead><tbody>{data.recentChecks.length ? data.recentChecks.map((check) => {
        const open = editorOrigin?.kind === "table-check" && editorOrigin.checkId === check.id;
        return <Fragment key={check.id}><tr className={open ? "source-row expanded" : "source-row"}><td>{new Date(check.opened_at).toLocaleString()}</td><td><strong>{check.server_name}</strong></td><td>{check.party_size}</td><td>${check.subtotal.toFixed(2)}</td><td>{check.is_itemized ? `${check.item_rows} rows` : "Check only"}</td><td><span className={`source-tag ${check.source_type}`}>{check.source_type}</span></td><td>{check.note || "—"}</td><td><button className="button table-action" aria-expanded={open} aria-controls={`check-editor-${check.id}`} onClick={() => toggleTableCheck(check)}>Edit</button></td></tr>{open && <tr className="inline-tool-row"><td colSpan={8}><div className="inline-tool" id={`check-editor-${check.id}`}>{originContent({ kind: "table-check", checkId: check.id })}</div></td></tr>}</Fragment>;
      }) : <tr><td colSpan={8}>No checks match that search.</td></tr>}</tbody></table></div>
      <nav className="data-pagination" aria-label="Sales data pages"><span>Page {data.page} of {data.pageCount}</span><div>{data.page > 1 && <a className="button secondary" href={pageHref(data.page - 1)}>Previous</a>}{data.page < data.pageCount && <a className="button secondary" href={pageHref(data.page + 1)}>Next</a>}</div></nav>
    </section>
  </section>;
}
