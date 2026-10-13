"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { useState } from "react";
import { getJson } from "@/lib/client";
import { useHealth } from "./Providers";

type Size = "sm" | "lg";

/**
 * Vote = sign a free, single-use message with Phantom. No transaction is sent.
 * The server checks the signature, the wallet's cooldown, caps and balance.
 */
export function VoteButton({
  mint,
  symbol,
  size = "sm",
  onVoted,
}: {
  mint: string;
  symbol: string;
  size?: Size;
  onVoted?: () => void;
}) {
  const { publicKey, signMessage, connected } = useWallet();
  const health = useHealth();
  const [state, setState] = useState<"idle" | "signing" | "sending" | "done">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const [beat, setBeat] = useState(0);

  const offline = health && !health.voting;

  async function vote() {
    setMsg(null);
    if (!connected || !publicKey) return setMsg("Connect Phantom to vote.");
    if (!signMessage) return setMsg("This wallet can't sign messages, so it can't vote.");
    try {
      setState("signing");
      const wallet = publicKey.toBase58();
      const ch = await getJson<{ nonce: string; message: string }>("/api/vote/challenge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet, mint }),
      });
      const sig = await signMessage(new TextEncoder().encode(ch.message));
      setState("sending");
      await getJson("/api/vote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet, mint, nonce: ch.nonce, signature: bs58.encode(sig) }),
      });
      setState("done");
      setBeat((b) => b + 1);
      setMsg(`Vote counted for ${symbol}.`);
      onVoted?.();
    } catch (e) {
      const err = e as Error & { name?: string };
      setState("idle");
      setMsg(err.name === "WalletSignMessageError" || /reject|cancel/i.test(err.message) ? "Signature cancelled. No vote was cast." : err.message);
    }
  }

  const busy = state === "signing" || state === "sending";
  const label = state === "signing" ? "Sign in Phantom…" : state === "sending" ? "Counting…" : state === "done" ? "Encored" : "Revive";

  return (
    <div className={size === "lg" ? "flex flex-col items-stretch gap-1.5" : "inline-flex flex-col items-end gap-1"}>
      <button
        type="button"
        onClick={vote}
        disabled={busy || !!offline}
        title={offline ? "Voting is offline on this deployment" : `Call ${symbol} back for an encore`}
        className={`${state === "done" ? "btn-ghost text-pulse" : "btn-ember"} ${size === "lg" ? "px-5 py-2.5 text-[15px]" : "px-3 py-1.5 text-xs"}`}
      >
        <span key={beat} className={beat ? "inline-block animate-beat" : "inline-block"} aria-hidden="true">
          ♥
        </span>
        {label}
      </button>
      {msg && (
        <span role="status" className={`max-w-[260px] text-[11px] leading-snug ${state === "done" ? "text-pulse" : "text-bone-dim"}`}>
          {msg}
        </span>
      )}
    </div>
  );
}
