import Link from "next/link";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ThemeManager } from "./theme-manager";

const items = [
  { href: "/", label: "Dashboard" },
  { href: "/bingo", label: "Server Bingo" },
  { href: "/wheel", label: "Prize Wheel" },
  { href: "/contest", label: "Contest setup" },
  { href: "/data", label: "Sales" },
  { href: "/games", label: "Gameboards" },
];

export function AppNav({ current }: { current: string }) {
  const themePrompt = readFileSync(path.join(process.cwd(), "docs", "AGENT_THEME_PROMPT.md"), "utf8");
  return <nav className="app-nav" aria-label="Primary navigation">
    {items.map((item) => <Link className={item.href === current ? "active" : ""} href={item.href} key={item.href}>{item.label}</Link>)}
    <ThemeManager prompt={themePrompt} />
  </nav>;
}
