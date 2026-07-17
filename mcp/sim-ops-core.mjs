const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function normalizeBaseUrl(raw = process.env.SIM_BASE_URL || "http://127.0.0.1:3000") {
  let url;
  try { url = new URL(raw); } catch { throw new Error("base_url must be a valid loopback HTTP URL."); }
  if (url.protocol !== "http:" || !loopbackHosts.has(url.hostname) || url.username || url.password || (url.pathname !== "/" && url.pathname !== "") || url.search || url.hash) throw new Error("base_url must be a loopback HTTP origin on localhost, 127.0.0.1, or ::1.");
  return url.origin;
}

export async function requestOps(baseUrl, pathname, options = {}, fetchImpl = fetch) {
  const origin = normalizeBaseUrl(baseUrl);
  const response = await fetchImpl(`${origin}${pathname}`, { ...options, headers: { "content-type": "application/json", ...(options.headers ?? {}) } });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const code = payload?.error?.code ? `${payload.error.code}: ` : "";
    throw new Error(`${code}${payload?.error?.message || `SIM operations API returned HTTP ${response.status}`}`);
  }
  return payload;
}

function command(args, action, payload) {
  return { operation_id: args.operation_id, action, actor_role: args.actor_role, expected_contest_id: args.expected_contest_id, confirm: args.confirm ?? false, payload };
}

export async function callOpsTool(name, args = {}, fetchImpl = fetch) {
  const baseUrl = args.base_url;
  if (name === "get_runbook") return requestOps(baseUrl, `/api/ops/runbooks/${encodeURIComponent(args.role)}`, {}, fetchImpl);
  if (name === "get_ops_snapshot") return requestOps(baseUrl, "/api/ops/snapshot", {}, fetchImpl);
  if (name === "get_operation_receipt") return requestOps(baseUrl, `/api/ops/operations/${encodeURIComponent(args.operation_id)}`, {}, fetchImpl);
  if (name === "list_recent_operations") {
    const query = new URLSearchParams();
    if (args.limit !== undefined) query.set("limit", String(args.limit));
    if (args.role !== undefined) query.set("role", args.role);
    return requestOps(baseUrl, `/api/ops/operations?${query}`, {}, fetchImpl);
  }
  if (name === "preview_contest") return requestOps(baseUrl, "/api/ops/preview/contest", { method: "POST", body: JSON.stringify({ name: args.name, config: args.config }) }, fetchImpl);
  if (name === "preview_game_finalization") return requestOps(baseUrl, "/api/ops/preview/game", { method: "POST", body: JSON.stringify({ game_id: args.game_id }) }, fetchImpl);
  if (name === "preview_prize_drawing") return requestOps(baseUrl, "/api/ops/preview/wheel", { method: "POST", body: "{}" }, fetchImpl);

  let request;
  if (name === "record_contest_sales") request = command(args, "record_contest_sales", { serverId: args.server_id, menuItemId: args.menu_item_id, quantity: args.quantity, ...(args.note ? { note: args.note } : {}) });
  else if (name === "record_bingo_submission") request = command(args, "record_bingo_submission", { cardId: args.card_id, markedCells: args.marked_cells });
  else if (name === "record_full_check") request = command(args, "record_full_check", { serverId: args.server_id, openedAt: args.opened_at, partySize: args.party_size, note: args.note, items: args.items.map((item) => ({ menuItemId: item.menu_item_id, qty: item.qty, ...(item.price_each === undefined ? {} : { priceEach: item.price_each }) })) });
  else if (name === "correct_source_check") request = command(args, "correct_source_check", { checkId: args.check_id, serverId: args.server_id, openedAt: args.opened_at, partySize: args.party_size, note: args.note, items: args.items.map((item) => ({ menuItemId: item.menu_item_id, qty: item.qty, ...(item.price_each === undefined ? {} : { priceEach: item.price_each }) })) });
  else if (name === "activate_contest") request = command(args, "activate_contest", { name: args.name, config: args.config });
  else if (name === "finalize_sales_race") request = command(args, "finalize_sales_race", { gameId: args.game_id });
  else if (name === "award_goal_board") request = command(args, "award_goal_board", { gameId: args.game_id });
  else if (name === "draw_prize_winner") request = command(args, "draw_prize_winner", {});
  else throw new Error(`Unknown tool: ${name}`);
  return requestOps(baseUrl, "/api/ops/commands", { method: "POST", body: JSON.stringify(request) }, fetchImpl);
}

const baseUrlProperty = { type: "string", description: "Optional loopback SIM origin, such as http://127.0.0.1:3100 for a disposable run." };
const roleProperty = { type: "string", enum: ["contest_manager", "shift_manager"] };
const writeProperties = {
  base_url: baseUrlProperty,
  operation_id: { type: "string", minLength: 6, maxLength: 128, description: "Stable ID for this exact intent. Reuse it for retries." },
  actor_role: roleProperty,
  expected_contest_id: { type: "integer", minimum: 1, description: "Active contest ID read before composing this write." },
  confirm: { type: "boolean", default: false, description: "Must be true for irreversible manager actions." },
};
const readAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const writeAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const irreversibleAnnotations = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false };
const checkItemSchema = { type: "object", additionalProperties: false, required: ["menu_item_id", "qty"], properties: { menu_item_id: { type: "integer", minimum: 1 }, qty: { type: "integer", minimum: 1 }, price_each: { type: "number", minimum: 0, description: "Optional source price; current menu price is used when omitted." } } };

export const opsTools = [
  { name: "get_runbook", description: "Read the canonical operating runbook for one SIM manager role.", inputSchema: { type: "object", additionalProperties: false, required: ["role"], properties: { base_url: baseUrlProperty, role: roleProperty } }, annotations: readAnnotations },
  { name: "get_ops_snapshot", description: "Read active contest, servers, contest targets, games, Bingo count, wheel state, safety flags, and recent receipts.", inputSchema: { type: "object", additionalProperties: false, properties: { base_url: baseUrlProperty } }, annotations: readAnnotations },
  { name: "get_operation_receipt", description: "Reconcile one idempotent operation by its stable ID.", inputSchema: { type: "object", additionalProperties: false, required: ["operation_id"], properties: { base_url: baseUrlProperty, operation_id: writeProperties.operation_id } }, annotations: readAnnotations },
  { name: "list_recent_operations", description: "List recent operation receipts, optionally filtered by role.", inputSchema: { type: "object", additionalProperties: false, properties: { base_url: baseUrlProperty, limit: { type: "integer", minimum: 1, maximum: 100 }, role: roleProperty } }, annotations: readAnnotations },
  { name: "preview_contest", description: "Validate and normalize a proposed contest without changing SIM.", inputSchema: { type: "object", additionalProperties: false, required: ["name", "config"], properties: { base_url: baseUrlProperty, name: { type: "string", minLength: 1 }, config: { type: "object" } } }, annotations: readAnnotations },
  { name: "preview_game_finalization", description: "Preview proposed game awards without locking them.", inputSchema: { type: "object", additionalProperties: false, required: ["game_id"], properties: { base_url: baseUrlProperty, game_id: { type: "string", minLength: 1 } } }, annotations: readAnnotations },
  { name: "preview_prize_drawing", description: "Read the full contender field and entry breakdown without drawing.", inputSchema: { type: "object", additionalProperties: false, properties: { base_url: baseUrlProperty } }, annotations: readAnnotations },
  { name: "record_contest_sales", description: "Append one positive item quantity to an active contest target. Does not create a full check.", inputSchema: { type: "object", additionalProperties: false, required: ["operation_id", "actor_role", "expected_contest_id", "server_id", "menu_item_id", "quantity"], properties: { ...writeProperties, server_id: { type: "integer", minimum: 1 }, menu_item_id: { type: "integer", minimum: 1 }, quantity: { type: "integer", minimum: 1, maximum: 999 }, note: { type: "string", maxLength: 160 } } }, annotations: writeAnnotations },
  { name: "record_bingo_submission", description: "Log the marked cells from one current returned Bingo card.", inputSchema: { type: "object", additionalProperties: false, required: ["operation_id", "actor_role", "expected_contest_id", "card_id", "marked_cells"], properties: { ...writeProperties, card_id: { type: "integer", minimum: 1 }, marked_cells: { type: "array", uniqueItems: true, items: { type: "integer", minimum: 0, maximum: 24 } } } }, annotations: writeAnnotations },
  { name: "record_full_check", description: "Record one complete fictional itemized check. SIM derives subtotal from item lines; do not use this for contest-only sales.", inputSchema: { type: "object", additionalProperties: false, required: ["operation_id", "actor_role", "expected_contest_id", "server_id", "opened_at", "party_size", "note", "items"], properties: { ...writeProperties, server_id: { type: "integer", minimum: 1 }, opened_at: { type: "string", format: "date-time" }, party_size: { type: "integer", minimum: 1 }, note: { type: "string", minLength: 1, maxLength: 160 }, items: { type: "array", minItems: 1, maxItems: 50, items: checkItemSchema } } }, annotations: writeAnnotations },
  { name: "correct_source_check", description: "Correct one fictional source check with a required audit reason. SIM derives the corrected subtotal from item lines.", inputSchema: { type: "object", additionalProperties: false, required: ["operation_id", "actor_role", "expected_contest_id", "check_id", "server_id", "opened_at", "party_size", "note", "items"], properties: { ...writeProperties, check_id: { type: "integer", minimum: 1 }, server_id: { type: "integer", minimum: 1 }, opened_at: { type: "string", format: "date-time" }, party_size: { type: "integer", minimum: 1 }, note: { type: "string", minLength: 1, maxLength: 160 }, items: { type: "array", minItems: 1, maxItems: 50, items: checkItemSchema } } }, annotations: writeAnnotations },
  { name: "activate_contest", description: "Irreversibly close the current contest, activate the validated replacement, and create fresh cards.", inputSchema: { type: "object", additionalProperties: false, required: ["operation_id", "actor_role", "expected_contest_id", "confirm", "name", "config"], properties: { ...writeProperties, name: { type: "string", minLength: 1 }, config: { type: "object" } } }, annotations: irreversibleAnnotations },
  { name: "finalize_sales_race", description: "Irreversibly persist the final race places and wheel-entry awards.", inputSchema: { type: "object", additionalProperties: false, required: ["operation_id", "actor_role", "expected_contest_id", "confirm", "game_id"], properties: { ...writeProperties, game_id: { type: "string", minLength: 1 } } }, annotations: irreversibleAnnotations },
  { name: "award_goal_board", description: "Irreversibly persist currently eligible goal-board awards.", inputSchema: { type: "object", additionalProperties: false, required: ["operation_id", "actor_role", "expected_contest_id", "confirm", "game_id"], properties: { ...writeProperties, game_id: { type: "string", minLength: 1 } } }, annotations: irreversibleAnnotations },
  { name: "draw_prize_winner", description: "Irreversibly draw one weighted winner and save the entry snapshot.", inputSchema: { type: "object", additionalProperties: false, required: ["operation_id", "actor_role", "expected_contest_id", "confirm"], properties: writeProperties }, annotations: irreversibleAnnotations },
];
