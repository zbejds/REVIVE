"use client";

import { useState } from "react";
import { ENCORE_CA, X_HANDLE, X_URL } from "@/lib/site";

export function XIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

/** Round X button for the header. */
export function XButton() {
  if (!X_URL) return null;
  return (
    <a
      href={X_URL}
      target="_blank"
      rel="noreferrer"
      aria-label={`ENCORE on X (${X_HANDLE})`}
      title={`Follow ${X_HANDLE} on X`}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-bone transition hover:border-white/25 hover:bg-white/[0.1]"
    >
      <XIcon />
    </a>
  );
}

/**
 * $ENCORE contract address pill. While ENCORE_CA is empty it shows
 * "Coming soon"; once set it shows the address with copy + trade links.
 */
export function EncorePill({ compact = false }: { compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const ca = ENCORE_CA.trim();

  function copy() {
    if (!ca) return;
    navigator.clipboard
      ?.writeText(ca)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }

  return (
    <div
      className={`flex w-fit max-w-full flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md ${
        compact ? "px-3 py-1.5" : "px-4 py-2.5"
      }`}
    >
      <span className="grad-text font-display text-sm font-black">$ENCORE</span>
      <span className="label text-[10px]">CA</span>
      {ca ? (
        <>
          <code className="num min-w-0 truncate text-xs text-bone-dim" title={ca}>
            {compact ? `${ca.slice(0, 6)}…${ca.slice(-6)}` : ca}
          </code>
          <button
            type="button"
            onClick={copy}
            className="rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] text-bone transition hover:bg-white/[0.08]"
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
          {!compact && (
            <>
              <a
                href={`https://pump.fun/coin/${ca}`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-ember hover:underline"
              >
                pump.fun ↗
              </a>
              <a
                href={`https://dexscreener.com/solana/${ca}`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-pulse hover:underline"
              >
                Chart ↗
              </a>
            </>
          )}
        </>
      ) : (
        <span className="text-xs text-muted">Coming soon</span>
      )}
    </div>
  );
}

/** "More legends coming soon" teaser, as a wide strip or as a grid card. */
export function ComingSoon({ variant = "strip" }: { variant?: "strip" | "card" }) {
  const ghosts = ["?", "?", "?"];
  const stack = (
    <span className="flex -space-x-2" aria-hidden="true">
      {ghosts.map((g, i) => (
        <span
          key={i}
          className="grid h-9 w-9 place-items-center rounded-full border border-dashed border-pulse/50 bg-pulse/10 font-display text-xs font-bold text-pulse"
        >
          {g}
        </span>
      ))}
    </span>
  );
  const suggest = X_URL ? (
    <a
      href={X_URL}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-bone transition hover:border-white/25 hover:bg-white/[0.06]"
    >
      <XIcon className="h-3.5 w-3.5" /> Suggest a coin
    </a>
  ) : null;

  if (variant === "card") {
    return (
      <li className="flex min-h-[230px] flex-col items-center justify-center gap-3 rounded-[22px] border border-dashed border-pulse/40 bg-pulse/[0.04] p-6 text-center">
        {stack}
        <p className="font-display text-lg font-bold">More legends coming soon</p>
        <p className="max-w-[260px] text-sm text-bone-dim">New forgotten Solana memecoins join the archive regularly. Vote for the ones you want back next.</p>
        {suggest}
      </li>
    );
  }
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-dashed border-pulse/40 bg-pulse/[0.04] px-5 py-4">
      <div className="flex items-center gap-3">
        {stack}
        <div>
          <p className="font-display text-base font-bold">More legends coming soon</p>
          <p className="text-xs text-bone-dim">New forgotten Solana memecoins join the board regularly.</p>
        </div>
      </div>
      {suggest}
    </div>
  );
}
