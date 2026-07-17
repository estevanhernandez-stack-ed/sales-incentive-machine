import { describe, expect, it, vi } from "vitest";
import { callOpsTool, normalizeBaseUrl, opsTools } from "./sim-ops-core.mjs";

describe("SIM operations MCP client", () => {
  it("allows only loopback HTTP origins", () => {
    expect(normalizeBaseUrl("http://127.0.0.1:3100")).toBe("http://127.0.0.1:3100");
    expect(normalizeBaseUrl("http://localhost:3000")).toBe("http://localhost:3000");
    expect(() => normalizeBaseUrl("https://localhost:3000")).toThrow("loopback HTTP");
    expect(() => normalizeBaseUrl("http://example.com")).toThrow("loopback HTTP");
    expect(() => normalizeBaseUrl("http://127.0.0.1:3000/api")).toThrow("origin");
  });

  it("marks reads and irreversible writes accurately", () => {
    expect(opsTools.find((tool) => tool.name === "get_ops_snapshot")?.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    expect(opsTools.find((tool) => tool.name === "record_contest_sales")?.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false, idempotentHint: true });
    expect(opsTools.find((tool) => tool.name === "draw_prize_winner")?.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true, idempotentHint: true });
  });

  it("maps a tally to the typed commands endpoint", async () => {
    const fetchImpl = vi.fn(async (url, init) => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }));
    await callOpsTool("record_contest_sales", { base_url: "http://127.0.0.1:3100", operation_id: "shift-entry-001", actor_role: "shift_manager", expected_contest_id: 1, server_id: 2, menu_item_id: 1, quantity: 4 }, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:3100/api/ops/commands");
    expect(JSON.parse(init.body)).toEqual({ operation_id: "shift-entry-001", action: "record_contest_sales", actor_role: "shift_manager", expected_contest_id: 1, confirm: false, payload: { serverId: 2, menuItemId: 1, quantity: 4 } });
  });
});
