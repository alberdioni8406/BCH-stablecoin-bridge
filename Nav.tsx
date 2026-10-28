"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const links = [
  { href: "/", label: "Swap" },
  { href: "/routes", label: "Route Explorer" },
  { href: "/tracker", label: "Tracker" },
  { href: "/status", label: "Status" },
  { href: "/docs", label: "Docs & Risks" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="border-b border-surface-border bg-surface-raised/80 backdrop-blur sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-6xl flex items-center justify-between h-14">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="w-7 h-7 rounded-md bg-bch/20 border border-bch/40 flex items-center justify-center text-bch text-sm">
            ₿
          </span>
          <span>
            BCH Stable<span className="text-bch">Bridge</span>
          </span>
        </Link>
        <nav className="flex gap-1 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={clsx(
                "px-3 py-1.5 rounded-md transition-colors",
                path === l.href
                  ? "bg-bch/15 text-bch"
                  : "text-gray-400 hover:text-gray-200 hover:bg-surface-overlay"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
