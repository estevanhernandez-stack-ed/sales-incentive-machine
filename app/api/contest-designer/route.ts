import { NextResponse } from "next/server";
import { openDatabase } from "../../../lib/db/client";
import { contestSchema, fallbackContest, getDesignerContext, validateContestConfig } from "../../../lib/contest-designer";

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json() as { prompt?: unknown };
    if (typeof prompt !== "string" || !prompt.trim()) return NextResponse.json({ error: "Please describe the contest goal." }, { status: 400 });
    const db = openDatabase(); const context = getDesignerContext(db); db.close();
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ config: fallbackContest(), label: "Sample config (no API key)" });
    let validationNote = "";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: process.env.OPENAI_MODEL ?? "gpt-5.6", input: [{ role: "system", content: "Create a practical weekly restaurant sales contest. Use only supplied menu IDs. Favor relevant underselling items in the bingo pool and set achievable targets slightly above current performance. For optional goal fields return null. Exactly one of threshold or vs_house must be active." }, { role: "user", content: JSON.stringify({ manager_goal: prompt, validation_note: validationNote || undefined, ...context }) }], text: { format: { type: "json_schema", name: "contest_config", strict: true, schema: contestSchema } } }) });
        const payload = await response.json() as { output_text?: string; error?: { message?: string } };
        if (!response.ok || !payload.output_text) throw new Error(payload.error?.message ?? "OpenAI did not return a contest config");
        const config = validateContestConfig(JSON.parse(payload.output_text), new Set(context.menu.map((item) => item.id)));
        return NextResponse.json({ config, label: "Generated with OpenAI" });
      } catch (error) {
        validationNote = error instanceof Error ? error.message : "Invalid contest config";
      }
    }
    return NextResponse.json({ config: fallbackContest(), label: "AI config unavailable — sample config loaded" });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not generate config." }, { status: 400 }); }
}
