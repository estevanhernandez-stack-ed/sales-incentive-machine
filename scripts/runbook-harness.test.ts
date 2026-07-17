import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error The executable JavaScript harness intentionally has no build-time package surface.
import { scaffoldRun } from "./scaffold-run.mjs";
// @ts-expect-error The executable JavaScript harness intentionally has no build-time package surface.
import { verifyRun } from "./verify-run.mjs";
// @ts-expect-error The executable JavaScript harness intentionally has no build-time package surface.
import { markRunBlocked } from "./mark-run-blocked.mjs";

const created: string[] = [];

afterEach(() => {
  for (const directory of created.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe("disposable run harness", () => {
  it("copies the database and initializes role-scoped evidence without touching the source", () => {
    const source = path.resolve("data/sim.db");
    const before = fs.statSync(source).size;
    const result = scaffoldRun({ scenarioId: "shift-live-entry", requestedRunId: "vitest-shift-live-entry", now: new Date("2026-07-17T12:00:00.000Z") });
    created.push(result.runDir);
    expect(fs.existsSync(path.join(result.runDir, "sim.db"))).toBe(true);
    expect(fs.statSync(source).size).toBe(before);
    const prompt = fs.readFileSync(path.join(result.runDir, "OPERATOR_PROMPT.md"), "utf8");
    expect(prompt).toContain("You are acting as the Shift Manager");
    expect(prompt).toContain("Product source, specs, seed data, manifests, and prompts are read-only");
  });

  it("rejects a scaffold with unfinished evidence and debrief", () => {
    const result = scaffoldRun({ scenarioId: "manager-late-information", requestedRunId: "vitest-manager-late", now: new Date("2026-07-17T12:00:00.000Z") });
    created.push(result.runDir);
    const verification = verifyRun("vitest-manager-late");
    expect(verification.ok).toBe(false);
    expect(verification.problems).toContain("Debrief is incomplete");
    expect(verification.problems.some((problem: string) => problem.includes("Required checkpoint"))).toBe(true);
  });

  it("validates an explicitly blocked package without pretending screenshots passed", async () => {
    const result = scaffoldRun({ scenarioId: "shift-error-recovery", requestedRunId: "vitest-blocked-run", now: new Date("2026-07-17T12:00:00.000Z") });
    created.push(result.runDir);
    await markRunBlocked({ runId: "vitest-blocked-run", reason: "Approved browser connection unavailable." });
    expect(verifyRun("vitest-blocked-run")).toEqual({ ok: true, problems: [] });
    const evidence = JSON.parse(fs.readFileSync(path.join(result.runDir, "evidence.json"), "utf8"));
    expect(evidence.checkpoints.every((checkpoint: { result: string; screenshot_path: string | null }) => checkpoint.result === "blocked" && checkpoint.screenshot_path === null)).toBe(true);
  });
});
