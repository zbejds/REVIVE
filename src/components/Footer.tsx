import Link from "next/link";
import { Pulse } from "./Logo";

export function Footer() {
  return (
    <footer className="border-t border-line/70">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="flex items-center gap-2">
          <Pulse className="h-5 w-5" />
          <span className="font-display font-bold text-bone-dim">REVIVE</span> — Bring the legends back.
        </p>
        <p className="max-w-2xl leading-relaxed">
          Market data from DexScreener and GeckoTerminal. Swaps routed by Jupiter. Memecoins are extremely volatile and can go to zero; nothing here is financial advice.{" "}
          <Link href="/rules" className="underline underline-offset-2 hover:text-bone">Rules, fees & data sources</Link>
        </p>
      </div>
    </footer>
  );
}
