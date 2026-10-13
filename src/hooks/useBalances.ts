"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useState } from "react";
import { rpcCall } from "@/lib/client";

export interface TokenBalance {
  raw: bigint;
  ui: number;
  decimals: number;
}

/** SOL balance (and optionally one token's balance) for the connected wallet. */
export function useBalances(mint?: string) {
  const { publicKey, connected } = useWallet();
  const [sol, setSol] = useState<number | null>(null);
  const [token, setToken] = useState<TokenBalance | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!publicKey) return;
    const owner = publicKey.toBase58();
    try {
      const b = await rpcCall<{ value: number }>("getBalance", [owner, { commitment: "confirmed" }]);
      setSol(b.value / 1e9);
      if (mint) {
        type Acc = { account: { data: { parsed: { info: { tokenAmount: { amount: string; decimals: number; uiAmount: number | null } } } } } };
        const r = await rpcCall<{ value: Acc[] }>("getTokenAccountsByOwner", [owner, { mint }, { encoding: "jsonParsed", commitment: "confirmed" }]);
        let raw = BigInt(0);
        let decimals = 0;
        for (const a of r.value) {
          const ta = a.account.data.parsed.info.tokenAmount;
          raw += BigInt(ta.amount);
          decimals = ta.decimals;
        }
        setToken({ raw, decimals, ui: Number(raw) / 10 ** decimals });
      }
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [publicKey, mint]);

  useEffect(() => {
    if (!connected) {
      setSol(null);
      setToken(null);
      return;
    }
    void refresh();
    const id = setInterval(() => document.visibilityState === "visible" && void refresh(), 30_000);
    return () => clearInterval(id);
  }, [connected, refresh]);

  return { sol, token, error, refresh };
}
