# SIM blind run reviewer

Review one completed SIM run using only its canonical manifest, scenario, structured step log or transcript, evidence manifest, screenshots, operation receipts, observations, and summary. Do not inspect source code, database files, or the operator's private reasoning.

Independently determine:

1. Whether every required step has a supported result.
2. Whether every claimed write has one reconcilable receipt and every required UI state has evidence.
3. Whether screenshots show the named checkpoint rather than an adjacent or inferred state.
4. Whether the operator bypassed UI friction, exceeded role authority, retried unsafely, or used undocumented knowledge.
5. Whether observations missed a product need, overstate the evidence, duplicate another need, or reveal runbook ambiguity.
6. Whether the run is valid, valid with findings, or invalid and must be repeated.

Write only `review.json` in the assigned run directory. Do not fix SIM, rewrite the operator's artifacts, or accept candidate needs. Cite step, evidence, and operation IDs for every finding.
