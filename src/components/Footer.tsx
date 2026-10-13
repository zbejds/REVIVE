import Link from "next/link";
import { X_HANDLE, X_URL } from "@/lib/site";
import { Pulse } from "./Logo";
import { EncorePill, XIcon } from "./Social";

export function Footer() {
  return (
    <footer className="border-t border-line/70">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-6 text-xs text-muted sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2">
            <Pulse className="h-5 w-5" />
            <span className="font-display font-bold text-bone-dim">ENCORE</span> — Every legend gets an encore.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <EncorePill compact />
            {X_URL && (
              <a
                href={X_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-bone-dim transition hover:border-white/25 hover:text-bone"
              >
                <XIcon className="h-3.5 w-3.5" /> {X_HANDLE}
              </a>
            )}
          </div>
        </div>
        <p className="max-w-3xl leading-relaxed">
          Market data from DexScreener and GeckoTerminal. Swaps routed by Jupiter. Memecoins are extremely volatile and can go to zero; nothing here is financial advice.{" "}
          <Link href="/rules" className="underline underline-offset-2 hover:text-bone">Rules, fees & data sources</Link>
        </p>
      </div>
    </footer>
  );
}
