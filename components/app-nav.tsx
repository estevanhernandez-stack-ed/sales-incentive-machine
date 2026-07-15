import Link from "next/link";
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
  return <nav className="app-nav" aria-label="Primary navigation">
    {items.map((item) => <Link className={item.href === current ? "active" : ""} href={item.href} key={item.href}>{item.label}</Link>)}
    <ThemeManager />
  </nav>;
}
