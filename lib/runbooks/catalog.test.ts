import { describe, expect, it } from "vitest";
import { getRunbookByRole, listRunbooks, listScenarios, validateRunbook, validateScenario } from "./catalog";

describe("runbook catalog", () => {
  it("loads two validated role manifests with stable sequential steps", () => {
    const manifests = listRunbooks();
    expect(manifests).toHaveLength(2);
    expect(getRunbookByRole("contest_manager").steps.at(-1)?.id).toBe("CM-15");
    expect(getRunbookByRole("shift_manager").steps.at(-1)?.id).toBe("SM-11");
  });

  it("loads scenarios whose required steps belong to their role", () => {
    const scenarios = listScenarios();
    expect(scenarios.map((scenario) => scenario.id).sort()).toEqual([
      "manager-item-contest",
      "manager-late-information",
      "shift-error-recovery",
      "shift-live-entry"
    ]);
    expect(() => scenarios.forEach((scenario) => validateScenario(scenario))).not.toThrow();
  });

  it("rejects skipped step numbers and unknown scenario steps", () => {
    const manager = structuredClone(getRunbookByRole("contest_manager"));
    manager.steps[1].id = "CM-99";
    expect(() => validateRunbook(manager)).toThrow("Expected step CM-02");

    const scenario = structuredClone(listScenarios()[0]);
    scenario.required_steps.push("CM-99");
    expect(() => validateScenario(scenario)).toThrow("requires unknown step CM-99");
  });
});
