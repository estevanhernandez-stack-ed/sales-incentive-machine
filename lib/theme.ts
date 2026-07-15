export type ThemePalette = {
  name?: string;
  bg: string;
  glass_on_mica: string;
  glass: string;
  border: string;
  text: string;
  text_secondary: string;
  text_dim: string;
  text_muted: string;
  accent: string;
  positive: string;
  negative: string;
  bingo_marked: string;
  pace_marker: string;
  bar_bg: string;
  glass_alpha?: number;
  border_alpha?: number;
  border_tint?: string | null;
  inner_highlight?: { color: string; alpha: number } | null;
  card_corner_radius?: number;
  accent_bloom?: { blur: number; alpha: number } | null;
  monospace_font?: string | null;
  monospace_fallback?: string | null;
  opts_out_of_mica?: boolean;
};

export const defaultTheme: ThemePalette = {
  name: "Warm Signal",
  bg: "#171512",
  glass_on_mica: "#1d1916",
  glass: "#2b251f",
  border: "#6b4b2b",
  text: "#f7f0e6",
  text_secondary: "#d7c8b7",
  text_dim: "#b9ab9a",
  text_muted: "#948575",
  accent: "#f6ae55",
  positive: "#7bd6a0",
  negative: "#de9e91",
  bingo_marked: "#28784b",
  pace_marker: "#fff4dc",
  bar_bg: "#3b2b1d",
  glass_alpha: 0.92,
  border_alpha: 0.72,
  card_corner_radius: 16,
};

const requiredColors: Array<keyof ThemePalette> = ["bg", "glass_on_mica", "glass", "border", "text", "text_secondary", "text_dim", "text_muted", "accent", "positive", "negative", "bingo_marked", "pace_marker", "bar_bg"];
const hexPattern = /^#[0-9a-f]{6}$/i;

function rgb(hex: string) { const value = Number.parseInt(hex.slice(1), 16); return [value >> 16 & 255, value >> 8 & 255, value & 255] as const; }
function rgba(hex: string, alpha: number) { return `rgba(${rgb(hex).join(", ")}, ${alpha})`; }
function lighten(hex: string, amount: number) { return `rgb(${rgb(hex).map((channel) => Math.round(channel + (255 - channel) * amount)).join(", ")})`; }
function luminance(hex: string) { return rgb(hex).map((channel) => channel / 255).map((channel) => channel <= .03928 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0); }
function contrast(a: string, b: string) { const [bright, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (bright + .05) / (dark + .05); }

export function validateTheme(raw: unknown): ThemePalette {
  if (!raw || typeof raw !== "object") throw new Error("Theme must be a JSON object.");
  const theme = raw as ThemePalette;
  for (const key of requiredColors) if (typeof theme[key] !== "string" || !hexPattern.test(theme[key] as string)) throw new Error(`${key} must be a six-digit hex color.`);
  if (contrast(theme.text, theme.glass_on_mica) < 4.5) throw new Error("Primary text needs at least 4.5:1 contrast against the card surface.");
  for (const [key, value] of [["glass_alpha", theme.glass_alpha], ["border_alpha", theme.border_alpha]] as const) if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 1)) throw new Error(`${key} must be between 0 and 1.`);
  if (theme.card_corner_radius !== undefined && (!Number.isFinite(theme.card_corner_radius) || theme.card_corner_radius < 0 || theme.card_corner_radius > 40)) throw new Error("card_corner_radius must be between 0 and 40.");
  return theme;
}

export function themeVariables(raw: unknown): Record<string, string> {
  const theme = validateTheme(raw);
  const glassAlpha = theme.glass_alpha ?? .8;
  const borderAlpha = theme.border_alpha ?? .4;
  const wheel = [theme.accent, theme.positive, theme.negative, theme.pace_marker, theme.text_dim, theme.bingo_marked];
  return {
    "--bg": theme.bg,
    "--card": rgba(theme.glass_on_mica, glassAlpha),
    "--chrome": rgba(theme.glass_on_mica, .92),
    "--glass-hover": lighten(theme.glass, .1),
    "--border": rgba(theme.border_tint ?? theme.border, borderAlpha),
    "--text": theme.text,
    "--text-secondary": theme.text_secondary,
    "--text-dim": theme.text_dim,
    "--text-muted": theme.text_muted,
    "--accent": theme.accent,
    "--positive": theme.positive,
    "--negative": theme.negative,
    "--bingo-marked": theme.bingo_marked,
    "--pace-marker": theme.pace_marker,
    "--bar-bg": theme.bar_bg,
    "--inner-highlight": theme.inner_highlight ? rgba(theme.inner_highlight.color, theme.inner_highlight.alpha) : "transparent",
    "--card-radius": `${theme.card_corner_radius ?? 10}px`,
    "--value-font": theme.monospace_font ? `"${theme.monospace_font}", ${theme.monospace_fallback ?? "Consolas"}, monospace` : "Arial, Helvetica, sans-serif",
    "--value-bloom": theme.monospace_font && theme.accent_bloom ? `0 0 ${theme.accent_bloom.blur}px ${rgba(theme.accent, theme.accent_bloom.alpha)}` : "none",
    ...Object.fromEntries(wheel.map((color, index) => [`--wheel-${index + 1}`, color])),
  };
}

export function applyTheme(raw: unknown) {
  const theme = validateTheme(raw);
  const root = document.documentElement;
  for (const [key, value] of Object.entries(themeVariables(theme))) root.style.setProperty(key, value);
  root.classList.toggle("no-glass", Boolean(theme.opts_out_of_mica));
  localStorage.setItem("sim-theme", JSON.stringify(theme));
  window.dispatchEvent(new CustomEvent("sim-theme-change", { detail: theme }));
  return theme;
}

export function resetTheme() {
  localStorage.removeItem("sim-theme");
  document.documentElement.removeAttribute("style");
  document.documentElement.classList.remove("no-glass");
  window.dispatchEvent(new CustomEvent("sim-theme-change", { detail: defaultTheme }));
}
