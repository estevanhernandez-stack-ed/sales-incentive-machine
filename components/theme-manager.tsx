"use client";

import { useEffect, useRef, useState } from "react";
import { applyTheme, defaultTheme, resetTheme, type ThemePalette } from "../lib/theme";

export function ThemeManager() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [json, setJson] = useState(JSON.stringify(defaultTheme, null, 2));
  const [message, setMessage] = useState("Paste an agent-authored palette or choose a JSON file.");

  useEffect(() => { try { const saved = localStorage.getItem("sim-theme"); if (saved) setJson(JSON.stringify(JSON.parse(saved), null, 2)); } catch {} }, []);

  function apply() { try { const theme = applyTheme(JSON.parse(json)) as ThemePalette; setJson(JSON.stringify(theme, null, 2)); setMessage(`${theme.name ?? "Custom theme"} applied and saved.`); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not apply theme."); } }
  function restore() { resetTheme(); setJson(JSON.stringify(defaultTheme, null, 2)); setMessage("Warm Signal restored."); }
  async function loadFile(file?: File) { if (!file) return; try { const contents = await file.text(); setJson(JSON.stringify(JSON.parse(contents), null, 2)); setMessage("Theme loaded. Review it, then apply."); } catch { setMessage("That file is not valid JSON."); } }

  return <>
    <button className="theme-trigger" type="button" onClick={() => dialog.current?.showModal()}>Theme</button>
    <dialog className="theme-dialog" ref={dialog} onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }}>
      <form method="dialog" className="theme-dialog-heading"><div><p className="eyebrow">Agentic theming</p><h2>Re-tint SIM live</h2></div><button className="theme-close" aria-label="Close theme editor">×</button></form>
      <p>Give an agent the theme prompt, then paste its raw JSON here. SIM validates contrast and derives every hover, border, and surface state.</p>
      <label className="theme-file">Choose theme JSON<input type="file" accept="application/json,.json" onChange={(event) => loadFile(event.target.files?.[0])} /></label>
      <label><span className="sr-only">Theme JSON</span><textarea rows={18} value={json} onChange={(event) => setJson(event.target.value)} spellCheck={false} /></label>
      <div className="theme-actions"><button className="button" type="button" onClick={apply}>Apply theme</button><button className="button secondary" type="button" onClick={restore}>Restore default</button></div>
      <p className="theme-message" role="status">{message}</p>
    </dialog>
  </>;
}
