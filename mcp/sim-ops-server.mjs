#!/usr/bin/env node
import { callOpsTool, opsTools } from "./sim-ops-core.mjs";

function send(message) { process.stdout.write(`${JSON.stringify(message)}\n`); }
function success(id, result) { send({ jsonrpc: "2.0", id, result }); }
function failure(id, code, message) { send({ jsonrpc: "2.0", id, error: { code, message } }); }
function toolResult(value) { return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }], structuredContent: value }; }

async function handle(message) {
  if (!message || message.jsonrpc !== "2.0") return failure(message?.id ?? null, -32600, "Invalid JSON-RPC request");
  if (message.method === "notifications/initialized" || message.method === "notifications/cancelled") return;
  if (message.method === "initialize") return success(message.id, {
    protocolVersion: "2025-06-18",
    capabilities: { tools: { listChanged: false } },
    serverInfo: { name: "sim-operations", version: "1.0.0" },
    instructions: "Operate SIM through its local loopback operations API. Start with get_runbook and get_ops_snapshot. Preserve operation_id across retries, pass the active expected_contest_id on every write, and require explicit approval for irreversible manager actions. Use the visible UI first during discovery runs; tools must not hide UI friction. Never send real restaurant, employee, or guest data.",
  });
  if (message.method === "ping") return success(message.id, {});
  if (message.method === "tools/list") return success(message.id, { tools: opsTools });
  if (message.method === "tools/call") {
    try { return success(message.id, toolResult(await callOpsTool(message.params?.name, message.params?.arguments ?? {}))); }
    catch (error) { return success(message.id, { content: [{ type: "text", text: error instanceof Error ? error.message : "Tool failed" }], isError: true }); }
  }
  if (message.id !== undefined) failure(message.id, -32601, `Method not found: ${message.method}`);
}

let buffer = "";
let chain = Promise.resolve();
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, newline).trim(); buffer = buffer.slice(newline + 1);
    if (!line) continue;
    chain = chain.then(async () => { try { await handle(JSON.parse(line)); } catch { failure(null, -32700, "Parse error"); } });
  }
});
process.stdin.resume();
