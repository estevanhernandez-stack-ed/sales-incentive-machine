import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createBingoCardsForContest } from "../db/bingo";
import { OpsError } from "./errors";
import { canonicalJson, executeOperation, hashOperationRequest, previewContest } from "./service";
import type { OperationCommand } from "./types";

function fixture() {
  const db = new Database(":memory:");
  db.exec(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
  db.exec("INSERT INTO servers VALUES (1, 'Avery Moss', '#d97706', 1), (2, 'Blair Rowan', '#be123c', 1)");
  const insertItem = db.prepare("INSERT INTO menu_items VALUES (?, ?, 'app', 8, 0)");
  for (let id = 1; id <= 24; id += 1) insertItem.run(id, id === 1 ? "Ember Corn Cups" : `Sample Item ${id}`);
  const config = { goals: [{ metric: "item_count", menu_item_id: 1, threshold: 5 }], bingo_pool: Array.from({ length: 24 }, (_, index) => index + 1), entry_rules: { per_goal_met: 2, per_bingo_win: 1 }, prize: "First choice of shift meal", games: [{ id: "corn-race", type: "sales_race", title: "Corn Cup Sprint", metric: { metric: "item_count", menu_item_id: 1 }, entries_by_place: [3, 2] }] };
  db.prepare("INSERT INTO contests VALUES (1, 'Signal Sprint', '2026-07-13', ?, 'active', 'manual')").run(JSON.stringify(config));
  createBingoCardsForContest(db, 1, config.bingo_pool);
  return db;
}

function command(overrides: Partial<OperationCommand> = {}): OperationCommand {
  return { operation_id: "shift-entry-001", action: "record_contest_sales", actor_role: "shift_manager", expected_contest_id: 1, confirm: false, payload: { serverId: 1, menuItemId: 1, quantity: 4 }, ...overrides };
}

describe("operations service", () => {
  it("canonicalizes nested keys and hashes equivalent intent identically", () => {
    expect(canonicalJson({ z: 1, a: { y: 2, x: 3 } })).toBe('{"a":{"x":3,"y":2},"z":1}');
    expect(hashOperationRequest(command({ payload: { quantity: 4, menuItemId: 1, serverId: 1 } }))).toBe(hashOperationRequest(command()));
  });

  it("applies a write once and returns the original receipt on retry", () => {
    const db = fixture();
    const first = executeOperation(db, command());
    const retry = executeOperation(db, command());
    expect(first.operation.status).toBe("applied");
    expect(retry.operation.status).toBe("already_applied");
    expect(retry.result).toEqual(first.result);
    expect(db.prepare("SELECT COUNT(*) AS count FROM contest_score_entries").get()).toEqual({ count: 1 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM operation_receipts").get()).toEqual({ count: 1 });
  });

  it("rejects changed intent, stale contests, missing confirmation, and role escalation without receipts", () => {
    const db = fixture();
    executeOperation(db, command());
    expect(() => executeOperation(db, command({ payload: { serverId: 1, menuItemId: 1, quantity: 5 } }))).toThrowError(OpsError);
    expect(() => executeOperation(db, command({ operation_id: "shift-entry-002", expected_contest_id: 99 }))).toThrow(/active contest changed/i);
    expect(() => executeOperation(db, command({ operation_id: "shift-draw-001", action: "draw_prize_winner", payload: {}, confirm: false }))).toThrow(/cannot perform/i);
    expect(() => executeOperation(db, command({ operation_id: "manager-draw-001", actor_role: "contest_manager", action: "draw_prize_winner", payload: {}, confirm: false }))).toThrow(/explicit confirmation/i);
    expect(db.prepare("SELECT COUNT(*) AS count FROM operation_receipts").get()).toEqual({ count: 1 });
  });

  it("previews a replacement without changing the active contest", () => {
    const db = fixture();
    const current = db.prepare("SELECT config_json FROM contests WHERE id = 1").get() as { config_json: string };
    const preview = previewContest(db, { name: "Corn Cup Countdown", config: JSON.parse(current.config_json) });
    expect(preview).toMatchObject({ current_contest_id: 1, active_server_count: 2, planned_bingo_cards: 2, write_performed: false });
    expect(db.prepare("SELECT COUNT(*) AS count FROM contests").get()).toEqual({ count: 1 });
  });

  it("derives full-check subtotal and preserves correction history through receipts", () => {
    const db = fixture();
    const created = executeOperation(db, command({ operation_id: "shift-check-001", action: "record_full_check", payload: { serverId: 1, openedAt: "2026-07-17T18:00:00.000Z", partySize: 2, note: "Complete fictional check", items: [{ menuItemId: 1, qty: 2 }] } }));
    expect(created.result).toMatchObject({ checkId: 1, subtotal: 16, itemLines: 1 });
    const corrected = executeOperation(db, command({ operation_id: "shift-correct-001", action: "correct_source_check", payload: { checkId: 1, serverId: 1, openedAt: "2026-07-17T18:00:00.000Z", partySize: 3, note: "Corrected fictional party and quantity", items: [{ menuItemId: 1, qty: 3 }] } }));
    expect(corrected.result).toMatchObject({ checkId: 1, subtotal: 24, itemLines: 1 });
    expect(db.prepare("SELECT subtotal, party_size FROM checks WHERE id = 1").get()).toEqual({ subtotal: 24, party_size: 3 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM sales_corrections").get()).toEqual({ count: 1 });
  });

  it("activates atomically with fresh cards and records the replacement contest ID", () => {
    const db = fixture();
    const current = db.prepare("SELECT config_json FROM contests WHERE id = 1").get() as { config_json: string };
    const result = executeOperation(db, command({ operation_id: "manager-activate-001", actor_role: "contest_manager", action: "activate_contest", confirm: true, payload: { name: "Corn Cup Countdown", config: JSON.parse(current.config_json) } }));
    expect(result.operation.contest_id).toBe(2);
    expect(result.result).toMatchObject({ contestId: 2, previousContestId: 1, cardCount: 2 });
    expect(db.prepare("SELECT status FROM contests WHERE id = 1").get()).toEqual({ status: "closed" });
  });
});
