#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getCatalog, getRecentReceipts, openPosDatabase, recordCheck, recordShift } from "./boh-pos-core.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databasePath = process.env.SIM_DATABASE_PATH || path.join(repoRoot, "data", "sim.db");

const itemSchema = {
  type: "object", additionalProperties: false, required: ["menu_item_id", "qty"],
  properties: { menu_item_id: { type: "integer", minimum: 1, description: "ID from get_pos_catalog." }, qty: { type: "integer", minimum: 1, maximum: 99 } },
};
const checkProperties = {
  external_reference: { type: "string", minLength: 1, maxLength: 80, description: "Stable fictional POS receipt ID. Reusing it is idempotent." },
  server_id: { type: "integer", minimum: 1, description: "Active server ID from get_pos_catalog." },
  opened_at: { type: "string", format: "date-time", description: "Closed-check time as an exact UTC ISO timestamp with milliseconds." },
  party_size: { type: "integer", minimum: 1, maximum: 30 },
  items: { type: "array", minItems: 1, maxItems: 50, items: itemSchema, description: "Synthetic menu item IDs and quantities. SIM derives current prices and subtotal." },
  note: { type: "string", maxLength: 160, description: "Optional fictional operational note; never include real guest or employee data." },
};

const tools = [
  {
    name: "get_pos_catalog",
    description: "Read SIM's fake active servers, fake menu with current prices, and active contest before composing synthetic POS checks.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
    annotations: { title: "Get synthetic POS catalog", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "record_closed_check",
    description: "Atomically record one fully itemized fictional closed check. Prices and subtotal are derived from SIM's menu. external_reference makes retries idempotent.",
    inputSchema: { type: "object", additionalProperties: false, required: ["external_reference", "server_id", "opened_at", "party_size", "items"], properties: { ...checkProperties, source_label: { type: "string", maxLength: 60, description: "Fictional source label; defaults to agent-boh-pos." } } },
    annotations: { title: "Record synthetic closed check", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "record_shift",
    description: "Atomically record 1-100 fictional closed checks from one synthetic BOH POS shift. If any check is invalid, none are inserted.",
    inputSchema: { type: "object", additionalProperties: false, required: ["source_label", "checks"], properties: { source_label: { type: "string", minLength: 1, maxLength: 60 }, checks: { type: "array", minItems: 1, maxItems: 100, items: { type: "object", additionalProperties: false, required: ["external_reference", "server_id", "opened_at", "party_size", "items"], properties: checkProperties } } } },
    annotations: { title: "Record synthetic POS shift", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "get_recent_pos_receipts",
    description: "Read recent checks created through this synthetic POS MCP server for reconciliation and retry checks.",
    inputSchema: { type: "object", additionalProperties: false, properties: { limit: { type: "integer", minimum: 1, maximum: 100, default: 20 } } },
    annotations: { title: "Get recent synthetic POS receipts", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

function send(message) { process.stdout.write(`${JSON.stringify(message)}\n`); }
function success(id, result) { send({ jsonrpc: "2.0", id, result }); }
function failure(id, code, message) { send({ jsonrpc: "2.0", id, error: { code, message } }); }
function toolResult(value) { return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }], structuredContent: value }; }

function callTool(name, args) {
  const db = openPosDatabase(databasePath);
  try {
    if (name === "get_pos_catalog") return getCatalog(db);
    if (name === "record_closed_check") return recordCheck(db, args);
    if (name === "record_shift") return recordShift(db, args);
    if (name === "get_recent_pos_receipts") return { receipts: getRecentReceipts(db, args) };
    throw new Error(`Unknown tool: ${name}`);
  } finally { db.close(); }
}

function handle(message) {
  if (!message || message.jsonrpc !== "2.0") return failure(message?.id ?? null, -32600, "Invalid JSON-RPC request");
  if (message.method === "notifications/initialized" || message.method === "notifications/cancelled") return;
  if (message.method === "initialize") return success(message.id, {
    protocolVersion: "2025-06-18",
    capabilities: { tools: { listChanged: false } },
    serverInfo: { name: "sim-synthetic-boh-pos", version: "1.0.0" },
    instructions: "Use only fictional SIM data. Call get_pos_catalog before writes. record_closed_check and record_shift write fully itemized synthetic checks; never send real restaurant, employee, or guest data. Reuse external_reference when retrying so writes remain idempotent. This is a local demo POS simulator, not a production POS integration.",
  });
  if (message.method === "ping") return success(message.id, {});
  if (message.method === "tools/list") return success(message.id, { tools });
  if (message.method === "tools/call") {
    try { return success(message.id, toolResult(callTool(message.params?.name, message.params?.arguments ?? {}))); }
    catch (error) { return success(message.id, { content: [{ type: "text", text: error instanceof Error ? error.message : "Tool failed" }], isError: true }); }
  }
  if (message.id !== undefined) failure(message.id, -32601, `Method not found: ${message.method}`);
}

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, newline).trim(); buffer = buffer.slice(newline + 1);
    if (!line) continue;
    try { handle(JSON.parse(line)); } catch { failure(null, -32700, "Parse error"); }
  }
});
process.stdin.resume();
