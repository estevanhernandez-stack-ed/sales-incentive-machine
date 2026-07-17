"use client";

import { useMemo, useRef, useState } from "react";
import type { ContestCategory, ContestConfig, ContestGameConfig, ContestGoalConfig, MenuMissionConfig, SalesRaceConfig } from "../lib/contest-designer";
import type { ContestMenuItem } from "../lib/db/contest";

const metricOptions: Array<{ value: ContestGoalConfig["metric"]; label: string }> = [
  { value: "ppa", label: "Per-person average" },
  { value: "avg_check", label: "Average check" },
  { value: "alcohol_pct", label: "Alcohol sales %" },
  { value: "attach_rate", label: "Attachment rate" },
  { value: "item_count", label: "Menu item sales" },
  { value: "large_party_ppa", label: "Large-party PPA" },
];

const categoryOptions: Array<{ value: ContestCategory; label: string }> = [
  { value: "app", label: "Appetizers" }, { value: "entree", label: "Entrées" }, { value: "dessert", label: "Desserts" },
  { value: "cocktail", label: "Cocktails" }, { value: "top_shelf", label: "Top-shelf pours" }, { value: "na_bev", label: "Non-alcoholic beverages" },
];

function defaultGoal(metric: ContestGoalConfig["metric"], menuItems: ContestMenuItem[]): ContestGoalConfig {
  if (metric === "attach_rate") return { metric, category: "dessert", threshold: 0.25 };
  if (metric === "item_count") return { metric, menu_item_id: menuItems[0]?.id, threshold: 10 };
  return { metric, vs_house: true };
}

function gameList(config: ContestConfig) { return config.games ?? []; }

export function ContestBuilder({ initialContestId, initialName, initialConfig, menuItems }: { initialContestId: number; initialName: string; initialConfig: ContestConfig; menuItems: ContestMenuItem[] }) {
  const [name, setName] = useState(initialName);
  const [config, setConfig] = useState(initialConfig);
  const [message, setMessage] = useState("Editing the active contest as a starting point. Nothing changes until you activate it.");
  const [loading, setLoading] = useState(false);
  const activationOperation = useRef<string | null>(null);
  const race = gameList(config).find((game): game is SalesRaceConfig => game.type === "sales_race");
  const mission = gameList(config).find((game): game is MenuMissionConfig => game.type === "menu_mission");
  const menuById = useMemo(() => new Map(menuItems.map((item) => [item.id, item])), [menuItems]);

  function setGames(games: ContestGameConfig[]) { setConfig((current) => ({ ...current, games })); }
  function replaceGame(game: ContestGameConfig) { setGames([...gameList(config).filter((entry) => entry.id !== game.id), game]); }
  function removeGame(type: ContestGameConfig["type"]) { setGames(gameList(config).filter((game) => game.type !== type)); }
  function updateGoal(index: number, goal: ContestGoalConfig) { setConfig((current) => ({ ...current, goals: current.goals.map((entry, goalIndex) => goalIndex === index ? goal : entry) })); }

  function changeMetric(index: number, metric: ContestGoalConfig["metric"]) { updateGoal(index, defaultGoal(metric, menuItems)); }
  function changeTarget(index: number, mode: "house" | "threshold") {
    const goal = config.goals[index];
    updateGoal(index, mode === "house" ? { ...goal, threshold: undefined, vs_house: true } : { ...goal, vs_house: undefined, threshold: goal.metric === "alcohol_pct" || goal.metric === "attach_rate" ? 0.25 : goal.metric === "item_count" ? 10 : 25 });
  }
  function changeThreshold(index: number, value: number) {
    const goal = config.goals[index];
    updateGoal(index, { ...goal, threshold: goal.metric === "alcohol_pct" || goal.metric === "attach_rate" ? value / 100 : value, vs_house: undefined });
  }

  function enableRace(enabled: boolean) {
    if (!enabled) { removeGame("sales_race"); return; }
    const item = menuItems[0];
    replaceGame({ id: "featured-sales-race", type: "sales_race", title: `${item?.name ?? "Featured item"} Sales Race`, metric: { metric: "item_count", menu_item_id: item?.id }, entries_by_place: [3, 2, 1] });
  }

  function updateRaceFocus(kind: "item" | "category", value: string) {
    if (!race) return;
    if (kind === "item") {
      const item = menuById.get(Number(value));
      replaceGame({ ...race, title: `${item?.name ?? "Featured item"} Sales Race`, metric: { metric: "item_count", menu_item_id: Number(value) } });
    } else {
      const category = value as ContestCategory;
      const label = categoryOptions.find((option) => option.value === category)?.label ?? "Category";
      replaceGame({ ...race, title: `${label} Attachment Race`, metric: { metric: "attach_rate", category } });
    }
  }

  function enableMission(enabled: boolean) {
    if (!enabled) { removeGame("menu_mission"); return; }
    replaceGame({ id: "contest-goal-board", type: "menu_mission", title: `${name || "Contest"} Goal Board`, objectives: config.goals, entries_on_completion: 2 });
  }

  async function activate() {
    setLoading(true);
    const games = gameList(config).map((game) => game.type === "menu_mission" ? { ...game, objectives: config.goals } : game);
    const nextConfig = { ...config, games };
    try {
      const previewResponse = await fetch("/api/ops/preview/contest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, config: nextConfig }) });
      const preview = await previewResponse.json().catch(() => null) as { current_contest_id?: number; planned_bingo_cards?: number; error?: { message?: string } } | null;
      if (!previewResponse.ok || !preview?.current_contest_id) { setMessage(preview?.error?.message ?? "Could not validate this contest."); setLoading(false); return; }
      if (!window.confirm(`Activate ${name.trim()}? This closes the current contest and creates ${preview.planned_bingo_cards ?? 0} fresh Bingo cards.`)) { setMessage("Activation cancelled. The current contest is unchanged."); setLoading(false); return; }
      const operationId = activationOperation.current ?? `ui-manager-activate-${crypto.randomUUID()}`;
      activationOperation.current = operationId;
      const response = await fetch("/api/ops/commands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation_id: operationId, action: "activate_contest", actor_role: "contest_manager", expected_contest_id: initialContestId, confirm: true, payload: { name, config: nextConfig } }) });
      const result = await response.json().catch(() => null) as { operation?: { operation_id?: string }; error?: { message?: string } } | null;
      setLoading(false);
      if (response.ok) { activationOperation.current = null; setConfig(nextConfig); setMessage(`Contest activated. Receipt ${result?.operation?.operation_id}. Dashboard, Bingo, Wheel, and Gameboards now use these settings.`); }
      else { activationOperation.current = null; setMessage(result?.error?.message ?? "Could not activate this contest."); }
    } catch {
      setLoading(false);
      setMessage("Connection interrupted. Try again to reconcile the same activation receipt before creating another contest.");
    }
  }

  return <section className="contest-builder">
    <section className="setup-section contest-basics">
      <div className="setup-section-heading"><div><p className="eyebrow">Contest details</p><h2>Name the week and set the reward</h2></div><span className="setup-step">1</span></div>
      <div className="contest-field-grid"><label>Contest name<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>Prize<input value={config.prize} onChange={(event) => setConfig({ ...config, prize: event.target.value })} /></label></div>
    </section>

    <section className="setup-section">
      <div className="setup-section-heading"><div><p className="eyebrow">Sales goals</p><h2>Choose what counts as winning</h2><p>Each goal updates directly from recorded sales.</p></div><span className="setup-step">2</span></div>
      <div className="goal-builder-list">{config.goals.map((goal, index) => <article className="goal-builder" key={index}>
        <div className="goal-number">{index + 1}</div>
        <label>Metric<select value={goal.metric} onChange={(event) => changeMetric(index, event.target.value as ContestGoalConfig["metric"])}>{metricOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
        {goal.metric === "attach_rate" && <label>Focus<select value={goal.category ?? "dessert"} onChange={(event) => updateGoal(index, { ...goal, category: event.target.value as ContestCategory, menu_item_id: undefined })}>{categoryOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>}
        {goal.metric === "item_count" && <label>Menu item<select value={goal.menu_item_id} onChange={(event) => updateGoal(index, { ...goal, menu_item_id: Number(event.target.value) })}>{menuItems.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}
        <label>Target<select value={goal.vs_house ? "house" : "threshold"} onChange={(event) => changeTarget(index, event.target.value as "house" | "threshold")}><option value="house">Beat house average</option><option value="threshold">Set a target</option></select></label>
        {!goal.vs_house && <label>{goal.metric === "alcohol_pct" || goal.metric === "attach_rate" ? "Target %" : goal.metric === "item_count" ? "Quantity" : "Target $"}<input type="number" min="0" step={goal.metric === "alcohol_pct" || goal.metric === "attach_rate" ? "1" : goal.metric === "item_count" ? "1" : ".01"} value={goal.metric === "alcohol_pct" || goal.metric === "attach_rate" ? (goal.threshold ?? 0) * 100 : goal.threshold ?? 0} onChange={(event) => changeThreshold(index, Number(event.target.value))} /></label>}
        <button className="text-button danger" type="button" disabled={config.goals.length === 1} onClick={() => setConfig({ ...config, goals: config.goals.filter((_, goalIndex) => goalIndex !== index) })}>Remove</button>
      </article>)}</div>
      <button className="button secondary" type="button" onClick={() => setConfig({ ...config, goals: [...config.goals, defaultGoal("ppa", menuItems)] })}>Add sales goal</button>
    </section>

    <section className="setup-section">
      <div className="setup-section-heading"><div><p className="eyebrow">Prize scoring</p><h2>Set how servers earn wheel entries</h2></div><span className="setup-step">3</span></div>
      <div className="entry-rule-grid"><label>Entries per goal met<input type="number" min="0" step="1" value={config.entry_rules.per_goal_met} onChange={(event) => setConfig({ ...config, entry_rules: { ...config.entry_rules, per_goal_met: Number(event.target.value) } })} /></label><label>Entries per Bingo daily win<input type="number" min="0" step="1" value={config.entry_rules.per_bingo_win} onChange={(event) => setConfig({ ...config, entry_rules: { ...config.entry_rules, per_bingo_win: Number(event.target.value) } })} /></label></div>
    </section>

    <section className="setup-section">
      <div className="setup-section-heading"><div><p className="eyebrow">Sales gameboards</p><h2>Add live boards for the floor</h2><p>These boards use the same sales records as the dashboard.</p></div><span className="setup-step">4</span></div>
      <div className="game-setup-grid">
        <article className="game-setup-card"><label className="toggle-label"><input type="checkbox" checked={Boolean(race)} onChange={(event) => enableRace(event.target.checked)} /><span><strong>Featured sales race</strong><small>Rank servers on one item or category.</small></span></label>{race && <div className="game-setup-fields"><label>Focus type<select value={race.metric.metric === "attach_rate" ? "category" : "item"} onChange={(event) => updateRaceFocus(event.target.value as "item" | "category", event.target.value === "item" ? String(menuItems[0]?.id ?? "") : "dessert")}><option value="item">Menu item</option><option value="category">Menu category</option></select></label>{race.metric.metric === "attach_rate" ? <label>Category<select value={race.metric.category} onChange={(event) => updateRaceFocus("category", event.target.value)}>{categoryOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label> : <label>Menu item<select value={race.metric.menu_item_id} onChange={(event) => updateRaceFocus("item", event.target.value)}>{menuItems.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}<label>Board name<input value={race.title} onChange={(event) => replaceGame({ ...race, title: event.target.value })} /></label><div className="podium-inputs">{race.entries_by_place.map((entry, index) => <label key={index}>{index + 1}{index === 0 ? "st" : index === 1 ? "nd" : "rd"}<input type="number" min="0" step="1" value={entry} onChange={(event) => replaceGame({ ...race, entries_by_place: race.entries_by_place.map((value, place) => place === index ? Number(event.target.value) : value) })} /></label>)}</div></div>}</article>
        <article className="game-setup-card"><label className="toggle-label"><input type="checkbox" checked={Boolean(mission)} onChange={(event) => enableMission(event.target.checked)} /><span><strong>Contest goal board</strong><small>Show every server against all contest goals.</small></span></label>{mission && <div className="game-setup-fields"><label>Board name<input value={mission.title} onChange={(event) => replaceGame({ ...mission, title: event.target.value })} /></label><label>Entries for completing the board<input type="number" min="0" step="1" value={mission.entries_on_completion} onChange={(event) => replaceGame({ ...mission, entries_on_completion: Number(event.target.value) })} /></label><p className="setup-note">Uses all {config.goals.length} sales goal{config.goals.length === 1 ? "" : "s"} above.</p></div>}</article>
      </div>
    </section>

    <section className="activation-bar"><div><p className="eyebrow">Ready to publish</p><strong>{config.goals.length} goals · {gameList(config).length} gameboards · {config.bingo_pool.length} Bingo items</strong><p>Activating closes the current contest and creates fresh Bingo cards.</p></div><button className="button" disabled={loading || !name.trim()} onClick={activate}>{loading ? "Activating…" : "Activate this contest"}</button></section>
    <p className="designer-message" role="status">{message}</p>
  </section>;
}
