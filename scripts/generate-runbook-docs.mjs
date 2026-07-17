import fs from "node:fs";
import path from "node:path";
import { projectRoot, readManifest, renderList } from "./runbook-support.mjs";

const outputDir = path.join(projectRoot, "docs", "runbooks");
fs.mkdirSync(outputDir, { recursive: true });

function renderRunbook(manifest) {
  const sections = manifest.steps.map((step) => {
    const evidence = step.evidence.length
      ? step.evidence.map((item) => `- ${item.required ? "Required" : "Optional"}: \`${item.id}\` at \`${item.ui_path}\`; wait for “${item.wait_for}”; capture \`${item.capture_name}\`${item.receipt_required ? "; pair with its receipt" : ""}.`).join("\n")
      : "- No screenshot checkpoint. Save any required preview or reconciliation output in the run artifacts.";
    return `## ${step.id}: ${step.title}\n\n**Phase:** ${step.phase}  \n**Mode:** ${step.mode}  \n**Confirmation:** ${step.confirmation}\n\n${step.instruction}\n\n### Before starting\n\n${renderList(step.preconditions.length ? step.preconditions : ["No additional precondition."])}\n\n### Expected result\n\n${renderList(step.expected)}\n\n### Evidence\n\n${evidence}\n\n### Watch for\n\n${renderList(step.observations)}\n\n### Safe recovery\n\n${renderList(step.recovery)}\n\n### Do not\n\n${renderList(step.forbidden_shortcuts.length ? step.forbidden_shortcuts : ["No additional shortcuts are identified."])}`;
  }).join("\n\n");
  return `# ${manifest.title}\n\n> Generated from \`runbooks/${manifest.id}.json\`. Edit the manifest, then run \`npm run runbook:docs\`.\n\n${manifest.purpose}\n\n## Authority\n\n### Allowed\n\n${renderList(manifest.authority.allowed)}\n\n### Forbidden\n\n${renderList(manifest.authority.forbidden)}\n\n${sections}\n`;
}

const manifests = [readManifest("contest-manager"), readManifest("shift-manager")];
for (const manifest of manifests) fs.writeFileSync(path.join(outputDir, `${manifest.id}.md`), renderRunbook(manifest), "utf8");
fs.writeFileSync(path.join(outputDir, "README.md"), `# SIM operating runbooks\n\nThese human guides are generated from the same manifests used by the local operations API, agent prompts, run scaffolder, evidence verifier, and blind reviewer.\n\n- [Contest Manager](./contest-manager.md)\n- [Shift Manager](./shift-manager.md)\n- [Local operations API and MCP](./operations-api.md)\n\n## Commands\n\n- \`npm run runbook:docs\` regenerates the human guides.\n- \`npm run runbook:scaffold -- --scenario shift-live-entry\` creates a disposable run.\n- \`npm run runbook:serve -- --run <run-id> --port 3100\` runs SIM against that copied database.\n- \`npm run runbook:verify -- --run <run-id>\` checks evidence, receipts, observations, and debrief completion.\n\nThe governing contract is [the agent-executable runbook specification](../superpowers/specs/2026-07-17-agent-executable-runbooks.md).\n`, "utf8");
console.log(`Generated ${manifests.length} role guides in ${outputDir}`);
