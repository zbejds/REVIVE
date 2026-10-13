"use client";

import { WalletReadyState } from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";
import type { WalletName } from "@solana/wallet-adapter-base";
import { useEffect, useRef, useState } from "react";
import { useBalances } from "@/hooks/useBalances";
import { fmtNum, shortAddr } from "@/lib/format";

const PHANTOM = "Phantom" as WalletName<"Phantom">;

export function WalletButton() {
  const { wallets, wallet, select, connect, disconnect, connected, connecting, publicKey } = useWallet();
  const { sol } = useBalances();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const wantConnect = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const phantom = wallets.find((w) => w.adapter.name === PHANTOM);
  const installed = phantom && (phantom.readyState === WalletReadyState.Installed || phantom.readyState === WalletReadyState.Loadable);

  // select() is async in the adapter; connect once Phantom is the selected wallet.
  useEffect(() => {
    if (wantConnect.current && wallet?.adapter.name === PHANTOM && !connected && !connecting) {
      wantConnect.current = false;
      connect().catch((e: Error) => setErr(e.name === "WalletConnectionError" ? "Connection was cancelled in Phantom." : e.message));
    }
  }, [wallet, connected, connecting, connect]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  if (!connected || !publicKey) {
    if (phantom && !installed && phantom.readyState === WalletReadyState.NotDetected) {
      return (
        <a href="https://phantom.com/download" target="_blank" rel="noreferrer" className="btn-ghost">
          Install Phantom
        </a>
      );
    }
    return (
      <div className="flex items-center gap-2">
        {err && <span className="hidden max-w-[220px] truncate text-xs text-down lg:inline" role="alert">{err}</span>}
        <button
          className="btn-pulse"
          disabled={connecting}
          onClick={() => {
            setErr(null);
            if (wallet?.adapter.name === PHANTOM) {
              connect().catch((e: Error) => setErr(e.message));
            } else {
              wantConnect.current = true;
              select(PHANTOM);
            }
          }}
        >
          <PhantomGlyph />
          {connecting ? "Connecting…" : "Connect Phantom"}
        </button>
      </div>
    );
  }

  const addr = publicKey.toBase58();
  return (
    <div className="relative" ref={menuRef}>
      <button className="btn-ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        <span className="h-2 w-2 rounded-full bg-up" aria-hidden="true" />
        <span className="num text-xs text-bone-dim">{sol == null ? "… SOL" : `${fmtNum(sol, 3)} SOL`}</span>
        <span className="num">{shortAddr(addr)}</span>
      </button>
      {open && (
        <div role="menu" className="panel absolute right-0 mt-2 w-64 p-3 shadow-2xl">
          <p className="label">Connected with Phantom</p>
          <p className="num mt-1 break-all text-xs text-bone-dim">{addr}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              className="btn-ghost text-xs"
              onClick={() => {
                navigator.clipboard?.writeText(addr).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }).catch(() => {});
              }}
            >
              {copied ? "Copied" : "Copy address"}
            </button>
            <a className="btn-ghost text-xs" href={`https://solscan.io/account/${addr}`} target="_blank" rel="noreferrer">
              Solscan ↗
            </a>
          </div>
          <button className="btn-ghost mt-2 w-full text-xs" onClick={() => { setOpen(false); void disconnect(); }}>
            Disconnect
          </button>
          <p className="mt-3 text-[11px] leading-snug text-muted">
            ENCORE never asks for your seed phrase or private key. Every trade and vote is approved in Phantom.
          </p>
        </div>
      )}
    </div>
  );
}

function PhantomGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3C6.5 3 3 7.4 3 12.2c0 3.6 2 6.8 4.6 6.8 1.5 0 2.4-1.3 3-2.4.3.9.9 1.6 1.9 1.6 1.2 0 2-.9 2.5-1.9.3.8.9 1.3 1.7 1.3C20.2 17.6 21 14 21 11.6 21 6.8 17.2 3 12 3Zm-2 8.6c-.7 0-1.2-.7-1.2-1.6s.5-1.6 1.2-1.6 1.2.7 1.2 1.6-.5 1.6-1.2 1.6Zm4.4 0c-.7 0-1.2-.7-1.2-1.6s.5-1.6 1.2-1.6 1.2.7 1.2 1.6-.5 1.6-1.2 1.6Z"
      />
    </svg>
  );
}
