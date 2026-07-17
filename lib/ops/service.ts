import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import { validateContestConfig, type ContestConfig } from "../contest-designer";
import { getBingoPageData, recordBingoSubmission } from "../db/bingo";
import { activateContest, getContestSetupData } from "../db/contest";
import { getDashboardData } from "../db/dashboard";
import { awardMenuMission, getGamesData, lockSalesRace } from "../db/games";
import { addContestScoreEntry, addManualSalesEntry, correctSalesCheck, getContestSalesData, type SalesItemInput } from "../db/sales-data";
import { drawWheel, getWheelData } from "../db/wheel";
import { OpsError, normalizeOpsError } from "./errors";
import type { OperationAction, OperationCommand, OperationEvidence, OperationResponse } from "./types";

type ReceiptRow = { operation_id: string; action: OperationAction; actor_role: "contest_manager" | "shift_manager"; expected_contest_id: number; request_hash: string; status: "applied"; response_json: string; created_at: string };
const actions = new Set<OperationAction>(["record_contest_sales", "record_bingo_submission", "record_full_check", "correct_source_check", "activate_contest", "finalize_sales_race", "award_goal_board", "draw_prize_winner"]);
const managerOnly = new Set<OperationAction>(["activate_contest", "finalize_sales_race", "award_goal_board", "draw_prize_winner"]);
const confirmations = new Set<OperationAction>(["activate_contest", "finalize_sales_race", "award_goal_board", "draw_prize_winner"]);

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

export function hashOperationRequest(command: OperationCommand) {
  return createHash("sha256").update(canonicalJson({ action: command.action, actor_role: command.actor_role, expected_contest_id: command.expected_contest_id, confirm: command.confirm, payload: command.payload })).digest("hex");
}

function activeContestId(db: Database.Database) {
  return (db.prepare("SELECT id FROM contests WHERE status = 'active' ORDER BY week_start DESC LIMIT 1").get() as { id: number } | undefined)?.id ?? null;
}

export function validateOperationCommand(value: unknown): OperationCommand {
  if (!value || typeof value !== "object") throw new OpsError("INVALID_REQUEST", "Operation body must be an object");
  const command = value as OperationCommand;
  if (typeof command.operation_id !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{5,127}$/.test(command.operation_id)) throw new OpsError("INVALID_REQUEST", "operation_id must be 6-128 safe characters");
  if (!actions.has(command.action)) throw new OpsError("INVALID_REQUEST", "Unknown operation action");
  if (!(command.actor_role === "contest_manager" || command.actor_role === "shift_manager")) throw new OpsError("INVALID_REQUEST", "Unknown actor role");
  if (!Number.isInteger(command.expected_contest_id)) throw new OpsError("INVALID_REQUEST", "expected_contest_id is required");
  if (typeof command.confirm !== "boolean") throw new OpsError("INVALID_REQUEST", "confirm must be true or false");
  if (!command.payload || typeof command.payload !== "object" || Array.isArray(command.payload)) throw new OpsError("INVALID_REQUEST", "payload must be an object");
  return command;
}

function integer(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  if (!Number.isInteger(value)) throw new OpsError("INVALID_REQUEST", `${key} must be a whole number`);
  return value as number;
}

function text(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  if (typeof value !== "string" || !value.trim()) throw new OpsError("INVALID_REQUEST", `${key} is required`);
  return value.trim();
}

function evidence(action: OperationAction, payload: Record<string, unknown>, result: unknown): OperationEvidence {
  if (action === "record_contest_sales") return { ui_path: `/data?server=${payload.serverId}&panel=contest`, wait_for: `Added ${payload.quantity}`, checkpoint_id: "SM-04-tally-confirmed" };
  if (action === "record_bingo_submission") {
    const serverId = (result as { serverId?: number }).serverId;
    return { ui_path: `/bingo${serverId ? `?server=${serverId}` : ""}`, wait_for: "Lines", checkpoint_id: "SM-07-bingo-confirmed" };
  }
  if (action === "record_full_check") return { ui_path: `/data?server=${payload.serverId}&panel=checks`, wait_for: "New sales entry saved", checkpoint_id: "SM-08-full-check" };
  if (action === "correct_source_check") return { ui_path: `/data?check=${payload.checkId}&panel=edit`, wait_for: "corrected", checkpoint_id: "SM-09-check-corrected" };
  if (action === "activate_contest") return { ui_path: "/", wait_for: String(payload.name), checkpoint_id: "CM-07-activated" };
  if (action === "finalize_sales_race" || action === "award_goal_board") return { ui_path: `/games?game=${encodeURIComponent(String(payload.gameId))}`, wait_for: "Final", checkpoint_id: "CM-12-awards" };
  return { ui_path: "/wheel", wait_for: "Winner", checkpoint_id: "CM-14-winner" };
}

function applyAction(db: Database.Database, action: OperationAction, payload: Record<string, unknown>) {
  if (action === "record_contest_sales") {
    const serverId = integer(payload, "serverId"); const menuItemId = integer(payload, "menuItemId"); const quantity = integer(payload, "quantity");
    const note = typeof payload.note === "string" ? payload.note : undefined;
    const result = addContestScoreEntry(db, { serverId, menuItemId, quantity, note });
    const item = db.prepare("SELECT name, price FROM menu_items WHERE id = ?").get(menuItemId) as { name: string; price: number } | undefined;
    const totalQuantity = (db.prepare("SELECT COALESCE(SUM(quantity), 0) AS total FROM contest_score_entries WHERE contest_id = ? AND server_id = ? AND menu_item_id = ?").get(result.contestId, serverId, menuItemId) as { total: number }).total;
    return { ...result, serverId, menuItemId, menuItemName: item?.name ?? "Contest item", quantity, itemValue: item ? item.price * quantity : null, totalQuantity };
  }
  if (action === "record_bingo_submission") {
    const cardId = integer(payload, "cardId");
    const card = db.prepare("SELECT server_id FROM bingo_cards WHERE id = ?").get(cardId) as { server_id: number } | undefined;
    if (!card) throw new OpsError("NOT_FOUND", "Bingo card not found");
    return { ...recordBingoSubmission(db, cardId, payload.markedCells), cardId, serverId: card.server_id };
  }
  if (action === "record_full_check" || action === "correct_source_check") {
    const rawItems = payload.items;
    if (!Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > 50) throw new OpsError("INVALID_REQUEST", "items must contain 1-50 complete item lines");
    const items = rawItems.map((raw, index) => {
      if (!raw || typeof raw !== "object") throw new OpsError("INVALID_REQUEST", `items[${index}] must be an object`);
      const line = raw as Record<string, unknown>;
      const menuItemId = integer(line, "menuItemId"); const qty = integer(line, "qty");
      const menu = db.prepare("SELECT price FROM menu_items WHERE id = ?").get(menuItemId) as { price: number } | undefined;
      if (!menu) throw new OpsError("NOT_FOUND", `Menu item ${menuItemId} not found`);
      const priceEach = line.priceEach === undefined ? menu.price : Number(line.priceEach);
      if (!Number.isFinite(priceEach) || priceEach < 0 || qty < 1) throw new OpsError("INVALID_REQUEST", `items[${index}] has an invalid quantity or price`);
      return { menuItemId, qty, priceEach } satisfies SalesItemInput;
    });
    const subtotal = Number(items.reduce((sum, item) => sum + item.qty * item.priceEach, 0).toFixed(2));
    const input = { serverId: integer(payload, "serverId"), openedAt: text(payload, "openedAt"), partySize: integer(payload, "partySize"), subtotal, note: text(payload, "note"), items };
    if (action === "record_full_check") return { checkId: addManualSalesEntry(db, input), subtotal, itemLines: items.length };
    const checkId = integer(payload, "checkId");
    return { checkId: correctSalesCheck(db, { checkId, ...input }), subtotal, itemLines: items.length };
  }
  if (action === "activate_contest") {
    const name = text(payload, "name");
    const menuItemIds = new Set((db.prepare("SELECT id FROM menu_items").all() as Array<{ id: number }>).map((row) => row.id));
    const config = validateContestConfig(payload.config, menuItemIds);
    return activateContest(db, { name, config });
  }
  if (action === "finalize_sales_race") return { gameId: text(payload, "gameId"), winners: lockSalesRace(db, text(payload, "gameId")) };
  if (action === "award_goal_board") return { gameId: text(payload, "gameId"), serverIds: awardMenuMission(db, text(payload, "gameId")) };
  return drawWheel(db);
}

export function executeOperation(db: Database.Database, value: unknown): OperationResponse {
  const command = validateOperationCommand(value);
  const requestHash = hashOperationRequest(command);
  try {
    return db.transaction(() => {
      const existing = db.prepare("SELECT operation_id, action, actor_role, expected_contest_id, request_hash, status, response_json, created_at FROM operation_receipts WHERE operation_id = ?").get(command.operation_id) as ReceiptRow | undefined;
      if (existing) {
        if (existing.request_hash !== requestHash || existing.action !== command.action || existing.actor_role !== command.actor_role || existing.expected_contest_id !== command.expected_contest_id) throw new OpsError("OPERATION_CONFLICT", "That operation_id was already used for different intent", { operation_id: command.operation_id });
        const original = JSON.parse(existing.response_json) as OperationResponse;
        return { ...original, operation: { ...original.operation, status: "already_applied" as const } };
      }
      if (managerOnly.has(command.action) && command.actor_role !== "contest_manager") throw new OpsError("ROLE_NOT_ALLOWED", `${command.actor_role} cannot perform ${command.action}`);
      if (confirmations.has(command.action) && !command.confirm) throw new OpsError("CONFIRMATION_REQUIRED", `${command.action} requires explicit confirmation`);
      const contestId = activeContestId(db);
      if (contestId === null) throw new OpsError("NOT_FOUND", "No active contest");
      if (contestId !== command.expected_contest_id) throw new OpsError("STALE_CONTEST", "The active contest changed before this operation", { expected_contest_id: command.expected_contest_id, active_contest_id: contestId });
      const result = applyAction(db, command.action, command.payload);
      const createdAt = new Date().toISOString();
      const response: OperationResponse = { ok: true, operation: { operation_id: command.operation_id, action: command.action, actor_role: command.actor_role, status: "applied", contest_id: command.action === "activate_contest" ? (result as { contestId: number }).contestId : contestId, created_at: createdAt }, result, evidence: evidence(command.action, command.payload, result) };
      db.prepare("INSERT INTO operation_receipts (operation_id, action, actor_role, expected_contest_id, request_hash, status, response_json, created_at) VALUES (?, ?, ?, ?, ?, 'applied', ?, ?)").run(command.operation_id, command.action, command.actor_role, command.expected_contest_id, requestHash, JSON.stringify(response), createdAt);
      return response;
    })();
  } catch (error) {
    throw normalizeOpsError(error);
  }
}

export function getOperationReceipt(db: Database.Database, operationId: string): OperationResponse | null {
  const row = db.prepare("SELECT response_json FROM operation_receipts WHERE operation_id = ?").get(operationId) as { response_json: string } | undefined;
  return row ? JSON.parse(row.response_json) as OperationResponse : null;
}

export function listOperationReceipts(db: Database.Database, options: { limit?: number; role?: "contest_manager" | "shift_manager" } = {}) {
  const limit = Math.min(Math.max(Math.floor(options.limit ?? 20), 1), 100);
  const rows = options.role
    ? db.prepare("SELECT response_json FROM operation_receipts WHERE actor_role = ? ORDER BY created_at DESC LIMIT ?").all(options.role, limit)
    : db.prepare("SELECT response_json FROM operation_receipts ORDER BY created_at DESC LIMIT ?").all(limit);
  return (rows as Array<{ response_json: string }>).map((row) => JSON.parse(row.response_json) as OperationResponse);
}

export function previewContest(db: Database.Database, value: unknown) {
  const payload = value as { name?: unknown; config?: unknown };
  if (typeof payload?.name !== "string" || !payload.name.trim()) throw new OpsError("INVALID_REQUEST", "Contest name is required");
  const ids = new Set((db.prepare("SELECT id FROM menu_items").all() as Array<{ id: number }>).map((item) => item.id));
  const config = validateContestConfig(payload.config, ids);
  const currentContestId = activeContestId(db);
  if (currentContestId === null) throw new OpsError("NOT_FOUND", "No active contest");
  const cardCount = (db.prepare("SELECT COUNT(*) AS count FROM servers WHERE active = 1").get() as { count: number }).count;
  return { ok: true, current_contest_id: currentContestId, proposed: { name: payload.name.trim(), config }, active_server_count: cardCount, planned_bingo_cards: cardCount, game_ids: (config.games ?? []).map((game) => game.id), write_performed: false };
}

export function previewGameFinalization(db: Database.Database, gameId: string) {
  const data = getGamesData(db);
  if (!data) throw new OpsError("NOT_FOUND", "No active contest");
  const game = data.games.find((entry) => entry.id === gameId);
  if (!game) throw new OpsError("NOT_FOUND", "Game not found");
  const final = game.awards.length > 0;
  const proposed = game.type === "sales_race" ? game.standings.slice(0, game.entries_by_place.length).map((entry, index) => ({ serverId: entry.id, value: entry.value, place: index + 1, entries: game.entries_by_place[index] })) : game.standings.filter((entry) => entry.objectives.every((objective) => objective.complete)).map((entry) => ({ serverId: entry.id, entries: game.entries_on_completion }));
  return { ok: true, contest_id: data.contestId, game_id: gameId, game_type: game.type, already_final: final, proposed_awards: proposed, write_performed: false };
}

export function previewPrizeDrawing(db: Database.Database) {
  const data = getWheelData(db);
  if (!data) throw new OpsError("NOT_FOUND", "No active contest");
  return { ok: true, contest: data.contest, already_drawn: Boolean(data.currentDrawing), total_entries: data.entries.reduce((sum, entry) => sum + entry.entries, 0), contenders: data.entries, write_performed: false };
}

export function getOpsSnapshot(db: Database.Database) {
  const dashboard = getDashboardData(db);
  if (!dashboard) throw new OpsError("NOT_FOUND", "No active contest");
  const contestSales = getContestSalesData(db);
  const contestSetup = getContestSetupData(db);
  const games = getGamesData(db);
  const wheel = getWheelData(db);
  const bingo = getBingoPageData(db);
  return { ok: true, contest: dashboard.contest, contest_config: contestSetup?.config ?? null, servers: dashboard.leaderboard, contest_sales: contestSales, games, bingo: bingo ? { contest: bingo.contest, current_card_count: bingo.cards.length, cards: bingo.cards.map((card) => ({ id: card.id, server_id: card.serverId, server_name: card.serverName })), daily_wins: bingo.dailyWins } : null, wheel, safety: { drawing_final: Boolean(wheel?.currentDrawing), games_final: games?.games.map((game) => ({ game_id: game.id, final: game.awards.length > 0 })) ?? [], active_contest_id: dashboard.contest.id }, recent_operations: listOperationReceipts(db, { limit: 10 }) };
}
