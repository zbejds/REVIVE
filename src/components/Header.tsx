"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { XButton } from "./Social";
import { WalletButton } from "./WalletButton";

const NAV = [
  { href: "/", label: "Leaderboard" },
  { href: "/discover", label: "Discover" },
  { href: "/rules", label: "Rules & fees" },
];

export function Header() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink/55 backdrop-blur-xl" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="shrink-0" aria-label="ENCORE home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((n) => {
            const on = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-full px-3.5 py-1.5 text-sm transition ${on ? "bg-white/[0.08] text-bone" : "text-bone-dim hover:text-bone"}`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <XButton />
          <WalletButton />
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-4 pb-2 md:hidden" aria-label="Main mobile">
        {NAV.map((n) => {
          const on = n.href === "/" ? path === "/" : path.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} className={`chip shrink-0 ${on ? "chip-on" : ""}`}>
              {n.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
