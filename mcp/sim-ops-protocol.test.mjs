import { spawn } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

let child;

afterEach(() => {
  if (child && !child.killed) child.kill();
  child = undefined;
});

function startServer() {
  child = spawn(process.execPath, [new URL("./sim-ops-server.mjs", import.meta.url).pathname.replace(/^\/(.:)/, "$1")], { stdio: ["pipe", "pipe", "pipe"] });
  let buffer = "";
  const pending = new Map();
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim(); buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const message = JSON.parse(line);
      const resolve = pending.get(message.id);
      if (resolve) { pending.delete(message.id); resolve(message); }
    }
  });
  return (message) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(message.id); reject(new Error(`Timed out waiting for ${message.method}`)); }, 5000);
    pending.set(message.id, (value) => { clearTimeout(timer); resolve(value); });
    child.stdin.write(`${JSON.stringify(message)}\n`);
  });
}

describe("SIM operations MCP protocol", () => {
  it("negotiates MCP and lists the complete annotated tool surface", async () => {
    const request = startServer();
    const initialized = await request({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "vitest", version: "1" } } });
    expect(initialized.result).toMatchObject({ protocolVersion: "2025-06-18", serverInfo: { name: "sim-operations" } });
    const listed = await request({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    expect(listed.result.tools).toHaveLength(15);
    expect(listed.result.tools.find((tool) => tool.name === "get_runbook").annotations.readOnlyHint).toBe(true);
    expect(listed.result.tools.find((tool) => tool.name === "draw_prize_winner").annotations.destructiveHint).toBe(true);
  });
});
