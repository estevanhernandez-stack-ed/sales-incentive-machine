import { describe, expect, it } from "vitest";
import { defaultTheme, themeVariables, validateTheme } from "./theme";

describe("agentic themes", () => {
  it("validates the default role palette and derives runtime surfaces", () => {
    expect(validateTheme(defaultTheme)).toEqual(defaultTheme);
    expect(themeVariables(defaultTheme)).toMatchObject({ "--bg": "#171512", "--accent": "#f6ae55", "--card-radius": "16px", "--wheel-1": "#f6ae55" });
  });

  it("rejects malformed colors and low-contrast primary text", () => {
    expect(() => validateTheme({ ...defaultTheme, accent: "orange" })).toThrow("accent");
    expect(() => validateTheme({ ...defaultTheme, text: "#1d1917" })).toThrow("4.5:1");
  });
});
