import { describe, expect, it } from "vitest";
import { contestSchema, fallbackContest, validateContestConfig } from "./contest-designer";

const menuIds = new Set(Array.from({ length: 40 }, (_, index) => index + 1));

describe("contest designer", () => {
  it("keeps the no-key fallback valid and demoable", () => expect(validateContestConfig(fallbackContest(), menuIds).bingo_pool).toHaveLength(28));

  it("uses a strict-compatible goal schema with nullable optional values", () => {
    const goalSchema = contestSchema.properties.goals.items;
    expect(goalSchema.required).toEqual(["metric", "category", "menu_item_id", "threshold", "vs_house"]);
    expect(goalSchema.additionalProperties).toBe(false);
    expect(goalSchema.properties.category).toHaveProperty("anyOf");
    expect(goalSchema.properties.threshold).toHaveProperty("anyOf");
  });

  it("normalizes nullable structured output into the app config", () => {
    const config = fallbackContest();
    const normalized = validateContestConfig({ ...config, goals: [{ metric: "ppa", category: null, menu_item_id: null, threshold: null, vs_house: true }] }, menuIds);
    expect(normalized.goals).toEqual([{ metric: "ppa", vs_house: true }]);
  });

  it("rejects invalid bingo items and implausible rate targets", () => {
    expect(() => validateContestConfig({ ...fallbackContest(), bingo_pool: Array.from({ length: 24 }, (_, index) => index + 100) }, menuIds)).toThrow("Bingo pool");
    expect(() => validateContestConfig({ ...fallbackContest(), goals: [{ metric: "attach_rate", category: "dessert", threshold: 1.2 }] }, menuIds)).toThrow("between 0 and 1");
  });

  it("validates manager-built gameboards and preserves their operational names", () => {
    const normalized = validateContestConfig(fallbackContest(), menuIds);
    expect(normalized.games).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "sales_race", title: "Ember Corn Cups Sales Race", entries_by_place: [3, 2, 1] }),
      expect.objectContaining({ type: "menu_mission", title: "Sweet Finish Goal Board", entries_on_completion: 2 }),
    ]));
    expect(() => validateContestConfig({ ...fallbackContest(), games: [{ id: "same", type: "sales_race", title: "One", metric: { metric: "item_count", menu_item_id: 1 }, entries_by_place: [1] }, { id: "same", type: "sales_race", title: "Two", metric: { metric: "item_count", menu_item_id: 2 }, entries_by_place: [1] }] }, menuIds)).toThrow("unique IDs");
  });
});
