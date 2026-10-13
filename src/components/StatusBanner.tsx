"use client";

import Link from "next/link";
import { useHealth } from "./Providers";

/** Tells users plainly which parts of ENCORE are offline on this deployment. */
export function StatusBanner() {
  const h = useHealth();
  if (!h || (h.voting && h.trading)) return null;
  const off: string[] = [];
  if (!h.voting) off.push("community voting (no database configured)");
  if (!h.trading) off.push("trading (no Jupiter API key configured)");
  return (
    <div className="border-b border-warn/25 bg-warn/[0.07]">
      <p className="mx-auto max-w-[1440px] px-4 py-2 text-xs text-warn sm:px-6">
        <strong className="font-semibold">Setup mode.</strong> Live market data and charts are on. Offline: {off.join(" and ")}.{" "}
        <Link href="/rules#setup" className="underline underline-offset-2">
          How to enable
        </Link>
      </p>
    </div>
  );
}
