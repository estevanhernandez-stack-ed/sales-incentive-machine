import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { parseArgs, projectRoot, readJson, resolveRunDir, writeJson } from "./runbook-support.mjs";

const args = parseArgs();
if (!args.run) throw new Error("Provide --run <run-id>");
const port = Number(args.port || 3100);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Port must be an integer from 1024 to 65535");
const runDir = resolveRunDir(args.run);
const databasePath = path.join(runDir, "sim.db");
if (!fs.existsSync(databasePath)) throw new Error(`Run database not found: ${databasePath}`);
const metadataPath = path.join(runDir, "run.json");
const metadata = readJson(metadataPath);
metadata.status = "running";
metadata.started_at ||= new Date().toISOString();
metadata.base_url = `http://127.0.0.1:${port}`;
writeJson(metadataPath, metadata);

const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextBin, "dev", "-p", String(port), "-H", "127.0.0.1"], {
  cwd: projectRoot,
  env: { ...process.env, SIM_DATABASE_PATH: databasePath, SIM_RUN_ID: args.run },
  stdio: "inherit"
});
child.on("exit", (code, signal) => process.exitCode = code ?? (signal ? 1 : 0));
