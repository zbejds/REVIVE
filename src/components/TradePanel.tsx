"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBalances } from "@/hooks/useBalances";
import { getJson, rpcCall } from "@/lib/client";
import { fmtNum, fmtPrice } from "@/lib/format";
import type { MarketData } from "@/lib/types";
import { useHealth } from "./Providers";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const SOL_RESERVE = 0.01; // keep for network fees / rent
const SLIPPAGES = [50, 100, 300]; // bps

interface Order {
  requestId?: string;
  transaction: string | null;
  inAmount: string;
  outAmount?: string;
  otherAmountThreshold?: string;
  priceImpactPct?: string | number;
  slippageBps?: number;
  router?: string;
  mode?: string;
  feeBps?: number;
  signatureFeeLamports?: number;
  prioritizationFeeLamports?: number;
  rentFeeLamports?: number;
  routePlan?: { swapInfo?: { label?: string }; percent?: number }[];
  errorCode?: number;
  errorMessage?: string;
  encorePlatformFeeBps: number;
}

type Phase = "form" | "review" | "preparing" | "signing" | "submitting" | "confirming" | "success" | "failed";

// ---------- helpers ----------
function parseUnits(s: string, decimals: number): bigint | null {
  const v = s.trim();
  if (!/^\d*\.?\d*$/.test(v) || v === "" || v === ".") return null;
  const [i, f = ""] = v.split(".");
  if (f.length > decimals) return null;
  return BigInt((i || "0") + f.padEnd(decimals, "0"));
}
function formatUnits(raw: bigint | string | undefined | null, decimals: number): number | null {
  if (raw == null || raw === "") return null;
  const b = typeof raw === "bigint" ? raw : BigInt(raw);
  return Number(b) / 10 ** decimals;
}
const b64ToBytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
function bytesToB64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function walletErr(e: unknown): string {
  const err = e as Error;
  if (/reject|cancel|denied|declined/i.test(err?.message ?? "") || err?.name === "WalletSignTransactionError")
    return "You cancelled in Phantom. Nothing was sent.";
  return err?.message || "Something went wrong.";
}

export function TradePanel({
  mint,
  symbol,
  decimals,
  market,
}: {
  mint: string;
  symbol: string;
  decimals: number | null;
  market: MarketData | null;
}) {
  const health = useHealth();
  const { publicKey, connected, signTransaction } = useWallet();
  const { sol, token, refresh } = useBalances(mint);

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [slip, setSlip] = useState<number | "auto">("auto");
  const [customSlip, setCustomSlip] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [reviewed, setReviewed] = useState<Order | null>(null);
  const [ackImpact, setAckImpact] = useState(false);
  const [result, setResult] = useState<{ signature?: string; message: string } | null>(null);
  const quoteSeq = useRef(0);

  const tokenDecimals = decimals ?? token?.decimals ?? null;
  const inDecimals = side === "buy" ? 9 : tokenDecimals ?? 0;
  const outDecimals = side === "buy" ? tokenDecimals ?? 0 : 9;
  const inMint = side === "buy" ? SOL_MINT : mint;
  const outMint = side === "buy" ? mint : SOL_MINT;
  const inSym = side === "buy" ? "SOL" : symbol;
  const outSym = side === "buy" ? symbol : "SOL";
  const slipBps = slip === "auto" ? null : slip;

  const amountRaw = useMemo(() => (tokenDecimals == null && side === "sell" ? null : parseUnits(amount, inDecimals)), [amount, inDecimals, side, tokenDecimals]);
  const amountNum = amountRaw != null ? formatUnits(amountRaw, inDecimals) ?? 0 : 0;

  // ---------- validation ----------
  let blocker: string | null = null;
  if (health && !health.trading) blocker = "Trading isn't configured on this deployment.";
  else if (tokenDecimals == null) blocker = "Token details are still loading.";
  else if (amount && amountRaw == null) blocker = `Enter a valid amount (max ${inDecimals} decimals).`;
  else if (connected && side === "buy" && sol != null && amountNum > 0 && amountNum + SOL_RESERVE > sol)
    blocker = `Not enough SOL. You have ${fmtNum(sol, 4)} SOL and should keep about ${SOL_RESERVE} SOL for fees.`;
  else if (connected && side === "sell" && token && amountRaw != null && amountRaw > token.raw)
    blocker = `You hold ${fmtNum(token.ui, 4)} ${symbol}.`;

  // ---------- live quotes ----------
  const fetchOrder = useCallback(
    async (withTaker: boolean): Promise<Order> => {
      const qs = new URLSearchParams({ inputMint: inMint, outputMint: outMint, amount: String(amountRaw) });
      if (withTaker && publicKey) qs.set("taker", publicKey.toBase58());
      if (slipBps) qs.set("slippageBps", String(slipBps));
      return getJson<Order>(`/api/swap/order?${qs}`);
    },
    [inMint, outMint, amountRaw, publicKey, slipBps],
  );

  useEffect(() => {
    if (phase !== "form") return;
    setOrder(null);
    setQuoteErr(null);
    if (!amountRaw || amountRaw <= BigInt(0) || (health && !health.trading) || tokenDecimals == null) return;
    const seq = ++quoteSeq.current;
    const run = async () => {
      setQuoting(true);
      try {
        // Quote without taker: price check only, no transaction built yet.
        const o = await fetchOrder(false);
        if (seq !== quoteSeq.current) return;
        if (!o.outAmount) throw new Error(o.errorMessage || "No trading route is available for this amount right now.");
        setOrder(o);
        setQuoteErr(null);
      } catch (e) {
        if (seq === quoteSeq.current) setQuoteErr((e as Error).message);
      } finally {
        if (seq === quoteSeq.current) setQuoting(false);
      }
    };
    const t = setTimeout(run, 450);
    const id = setInterval(() => document.visibilityState === "visible" && void run(), 15_000);
    return () => {
      clearTimeout(t);
      clearInterval(id);
    };
  }, [amountRaw, fetchOrder, phase, health, tokenDecimals]);

  // ---------- derived quote numbers ----------
  const q = reviewed ?? order;
  const outNum = q ? formatUnits(q.outAmount, outDecimals) : null;
  const minOut = q
    ? q.otherAmountThreshold
      ? formatUnits(q.otherAmountThreshold, outDecimals)
      : outNum != null && (slipBps ?? q.slippageBps)
        ? outNum * (1 - (slipBps ?? q.slippageBps ?? 0) / 10_000)
        : null
    : null;

  // Price impact vs. market: unit-safe estimate from the SOL-quoted top pool.
  const impact = useMemo(() => {
    if (!q || outNum == null || !amountNum) return null;
    const solQuoted = market?.topPair?.quoteSymbol === "SOL" || market?.topPair?.quoteMint === SOL_MINT;
    const px = market?.priceNative; // token price in SOL
    if (solQuoted && px) {
      const expected = side === "buy" ? amountNum / px : amountNum * px;
      if (expected > 0) return Math.max(0, (1 - outNum / expected) * 100);
    }
    if (q.priceImpactPct != null && q.priceImpactPct !== "") {
      const v = Math.abs(Number(q.priceImpactPct));
      return Number.isFinite(v) ? v * 100 : null; // Jupiter reports a fraction
    }
    return null;
  }, [q, outNum, amountNum, market, side]);

  const impactLevel = impact == null ? "ok" : impact >= 15 ? "severe" : impact >= 5 ? "high" : "ok";
  const networkLamports =
    q && (q.signatureFeeLamports != null || q.prioritizationFeeLamports != null || q.rentFeeLamports != null)
      ? (q.signatureFeeLamports ?? 0) + (q.prioritizationFeeLamports ?? 0) + (q.rentFeeLamports ?? 0)
      : null;
  const routeLabels = q?.routePlan?.map((r) => r.swapInfo?.label).filter(Boolean) as string[] | undefined;

  // ---------- actions ----------
  function startReview() {
    if (!order) return;
    setReviewed(order);
    setAckImpact(false);
    setPhase("review");
  }

  async function confirm() {
    if (!publicKey || !signTransaction || !reviewed) return;
    setResult(null);
    try {
      setPhase("preparing");
      const fresh = await fetchOrder(true);
      if (!fresh.transaction) throw new Error(fresh.errorMessage || "Jupiter couldn't build this transaction. Check your balance and try again.");
      if (fresh.outAmount && reviewed.outAmount && BigInt(fresh.outAmount) * BigInt(100) < BigInt(reviewed.outAmount) * BigInt(99)) {
        setReviewed(fresh);
        setPhase("review");
        setResult({ message: "The price moved more than 1% since you reviewed. Check the new numbers and confirm again." });
        return;
      }

      const tx = VersionedTransaction.deserialize(b64ToBytes(fresh.transaction));

      // Preflight: simulate before asking the wallet to sign.
      if (fresh.router !== "jupiterz") {
        const sim = await rpcCall<{ value: { err: unknown; logs?: string[] } }>("simulateTransaction", [
          fresh.transaction,
          { encoding: "base64", sigVerify: false, replaceRecentBlockhash: false, commitment: "confirmed" },
        ]).catch(() => null);
        if (sim?.value?.err) {
          const logs = (sim.value.logs ?? []).join(" ");
          const why = /insufficient (lamports|funds)/i.test(logs)
            ? "Not enough SOL to cover the trade and fees."
            : /slippage|0x1771|exceeds desired slippage/i.test(logs)
              ? "The price moved beyond your slippage limit. Raise slippage or try a smaller amount."
              : "The transaction would fail on-chain right now. Try again in a moment.";
          throw new Error(why);
        }
      }

      setPhase("signing");
      const signed = await signTransaction(tx);

      setPhase("submitting");
      const exec = await getJson<{ status: string; signature: string | null; error: string | null }>("/api/swap/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signedTransaction: bytesToB64(signed.serialize()), requestId: fresh.requestId }),
      });
      if (!exec.signature) throw new Error(exec.error || "The swap was not submitted.");

      // Only report success once the cluster confirms it.
      setPhase("confirming");
      const sig = exec.signature;
      const deadline = Date.now() + 75_000;
      while (Date.now() < deadline) {
        type S = { value: ({ err: unknown; confirmationStatus?: string } | null)[] };
        const st = await rpcCall<S>("getSignatureStatuses", [[sig], { searchTransactionHistory: true }]).catch(() => null);
        const s = st?.value?.[0];
        if (s?.err) {
          setPhase("failed");
          setResult({ signature: sig, message: "The transaction landed but failed on-chain. No tokens were swapped; only the network fee was used." });
          void refresh();
          return;
        }
        if (s && (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized")) {
          setPhase("success");
          setResult({ signature: sig, message: `Confirmed on Solana. ${side === "buy" ? "Bought" : "Sold"} ${symbol}.` });
          setAmount("");
          void refresh();
          setTimeout(() => void refresh(), 4000);
          return;
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      setPhase("failed");
      setResult({
        signature: sig,
        message: "Submitted, but not confirmed yet. The network may be congested. Check the explorer before trying again so you don't trade twice.",
      });
    } catch (e) {
      setPhase("failed");
      setResult({ message: walletErr(e) });
    }
  }

  function reset() {
    setPhase("form");
    setReviewed(null);
    setResult(null);
    setAckImpact(false);
  }

  const venue = market?.topPair?.venue;
  const busy = phase === "preparing" || phase === "signing" || phase === "submitting" || phase === "confirming";

  // ---------- render ----------
  return (
    <section id="trade" aria-labelledby="trade-title" className="panel scroll-mt-24 p-4">
      <div className="flex items-center justify-between">
        <h2 id="trade-title" className="font-display text-base font-bold">Trade {symbol}</h2>
        <span className="label">via Jupiter</span>
      </div>

      {venue === "pumpfun-curve" && (
        <p className="mt-3 rounded-lg border border-ember/30 bg-ember/[0.07] px-3 py-2 text-xs leading-snug text-ember">
          This token&apos;s deepest pool is still a pump.fun bonding curve. ENCORE trades it only when Jupiter returns a valid route.
        </p>
      )}
      {!market && (
        <p className="mt-3 rounded-lg border border-line px-3 py-2 text-xs text-bone-dim">
          No active market was found, so trading may not be possible right now.
        </p>
      )}

      {phase === "form" && (
        <>
          <div role="tablist" aria-label="Side" className="mt-4 grid grid-cols-2 rounded-lg bg-ink-2 p-1">
            {(["buy", "sell"] as const).map((s) => (
              <button
                key={s}
                role="tab"
                aria-selected={side === s}
                onClick={() => {
                  setSide(s);
                  setAmount("");
                }}
                className={`rounded-md py-2 text-sm font-semibold capitalize transition ${
                  side === s ? (s === "buy" ? "bg-up/15 text-up" : "bg-down/15 text-down") : "text-muted hover:text-bone"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <div className="flex items-baseline justify-between">
              <label htmlFor="trade-amount" className="label">You pay</label>
              {connected && (
                <span className="num text-[11px] text-muted">
                  Balance: {side === "buy" ? (sol == null ? "…" : `${fmtNum(sol, 4)} SOL`) : token ? `${fmtNum(token.ui, 4)} ${symbol}` : "…"}
                </span>
              )}
            </div>
            <div className="relative mt-1.5">
              <input
                id="trade-amount"
                inputMode="decimal"
                autoComplete="off"
                className="input num pr-20 text-lg"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(",", "."))}
              />
              <span className="num pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-bone-dim">{inSym}</span>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {side === "buy"
                ? [0.1, 0.5, 1].map((v) => (
                    <button key={v} className="btn-ghost px-0 py-1.5 text-xs" onClick={() => setAmount(String(v))}>
                      {v} SOL
                    </button>
                  ))
                : [25, 50, 75].map((p) => (
                    <button
                      key={p}
                      className="btn-ghost px-0 py-1.5 text-xs"
                      disabled={!token || token.raw === BigInt(0)}
                      onClick={() => token && setAmount(String(formatUnits((token.raw * BigInt(p)) / BigInt(100), token.decimals)))}
                    >
                      {p}%
                    </button>
                  ))}
              <button
                className="btn-ghost px-0 py-1.5 text-xs"
                disabled={side === "buy" ? !sol || sol <= SOL_RESERVE : !token || token.raw === BigInt(0)}
                onClick={() => {
                  if (side === "buy" && sol) setAmount(String(Math.floor((sol - SOL_RESERVE) * 1e6) / 1e6));
                  if (side === "sell" && token) setAmount(String(formatUnits(token.raw, token.decimals)));
                }}
              >
                Max
              </button>
            </div>
          </div>

          <SlippagePicker slip={slip} setSlip={setSlip} custom={customSlip} setCustom={setCustomSlip} />

          <QuoteBox
            loading={quoting}
            error={quoteErr}
            hasAmount={!!amountRaw && amountRaw > BigInt(0)}
            outNum={outNum}
            outSym={outSym}
            minOut={minOut}
            impact={impact}
            impactLevel={impactLevel}
            order={order}
            networkLamports={networkLamports}
            routeLabels={routeLabels}
            auto={slip === "auto"}
          />

          {blocker && amount && <p className="mt-3 text-xs text-warn" role="alert">{blocker}</p>}

          {!connected ? (
            <p className="mt-4 rounded-lg border border-line bg-ink-2 px-3 py-2.5 text-center text-sm text-bone-dim">
              Connect Phantom (top right) to trade. Quotes work without a wallet.
            </p>
          ) : (
            <button
              className={`${side === "buy" ? "bg-up text-[#06241A] hover:brightness-110" : "bg-down text-[#2A0910] hover:brightness-110"} btn mt-4 w-full py-3 text-[15px]`}
              disabled={!order || !!blocker || quoting}
              onClick={startReview}
            >
              Review {side === "buy" ? "buy" : "sell"}
            </button>
          )}
        </>
      )}

      {phase !== "form" && reviewed && (
        <div className="mt-4">
          <p className="label">{phase === "review" ? "Review your swap" : phase === "success" ? "Swap confirmed" : phase === "failed" ? "Swap not completed" : "In progress"}</p>
          <dl className="mt-3 space-y-2 rounded-lg border border-line bg-ink-2 p-3 text-sm">
            <Line k="You pay" v={`${fmtNum(formatUnits(reviewed.inAmount, inDecimals), 6)} ${inSym}`} />
            <Line k="You receive (est.)" v={`${fmtNum(formatUnits(reviewed.outAmount, outDecimals), 6)} ${outSym}`} strong />
            <Line k="Minimum received" v={minOut != null ? `${fmtNum(minOut, 6)} ${outSym}` : "Set by Jupiter (auto slippage)"} />
            <Line k="Price impact (est.)" v={impact != null ? `${impact.toFixed(2)}%` : "—"} tone={impactLevel === "ok" ? undefined : impactLevel === "high" ? "warn" : "down"} />
            <Line k="Slippage" v={slip === "auto" ? "Auto (Jupiter)" : `${(slip / 100).toFixed(2)}%`} />
            <Line k="Route" v={[reviewed.router, ...(routeLabels ?? [])].filter(Boolean).join(" → ") || "Jupiter"} />
            <Line k="Jupiter fee" v={reviewed.feeBps != null ? `${(reviewed.feeBps / 100).toFixed(2)}%` : "Included in quote"} />
            <Line k="ENCORE fee" v={reviewed.encorePlatformFeeBps ? `${(reviewed.encorePlatformFeeBps / 100).toFixed(2)}%` : "None"} />
            <Line k="Network fee" v={networkLamports != null ? `${fmtNum(networkLamports / 1e9, 6)} SOL` : "~0.000005 SOL + priority fee"} />
          </dl>
          {(reviewed.rentFeeLamports ?? 0) > 0 && (
            <p className="mt-2 text-[11px] text-muted">Includes a one-time token account deposit (rent), refundable if the account is closed.</p>
          )}

          {impactLevel === "severe" && phase === "review" && (
            <label className="mt-3 flex items-start gap-2 rounded-lg border border-down/40 bg-down/10 p-3 text-xs text-down">
              <input id="ack-impact" type="checkbox" className="mt-0.5" checked={ackImpact} onChange={(e) => setAckImpact(e.target.checked)} />
              Price impact is very high. Liquidity is thin and you may lose a large part of this trade. I understand.
            </label>
          )}

          {result && (
            <p role="status" className={`mt-3 text-sm ${phase === "success" ? "text-up" : phase === "failed" ? "text-down" : "text-warn"}`}>
              {result.message}{" "}
              {result.signature && (
                <a className="underline underline-offset-2" href={`https://solscan.io/tx/${result.signature}`} target="_blank" rel="noreferrer">
                  View on Solscan ↗
                </a>
              )}
            </p>
          )}

          {phase === "review" && (
            <>
              <p className="mt-3 text-[11px] leading-snug text-muted">
                Phantom will show you the transaction. Nothing happens unless you approve it there.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button className="btn-ghost py-2.5" onClick={reset}>Back</button>
                <button className="btn-pulse py-2.5" disabled={impactLevel === "severe" && !ackImpact} onClick={confirm}>
                  Confirm in Phantom
                </button>
              </div>
            </>
          )}

          {busy && (
            <ol className="mt-4 space-y-1.5 text-xs">
              {(["preparing", "signing", "submitting", "confirming"] as Phase[]).map((p, i) => {
                const steps = ["preparing", "signing", "submitting", "confirming"];
                const cur = steps.indexOf(phase);
                const done = i < cur, active = i === cur;
                const text = { preparing: "Fresh quote + simulation", signing: "Approve in Phantom", submitting: "Sending to Solana", confirming: "Waiting for confirmation" }[p as "preparing"];
                return (
                  <li key={p} className={`flex items-center gap-2 ${active ? "text-bone" : done ? "text-up" : "text-muted"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${active ? "animate-pulse bg-pulse" : done ? "bg-up" : "bg-line-strong"}`} />
                    {text}
                  </li>
                );
              })}
            </ol>
          )}

          {(phase === "success" || phase === "failed") && (
            <button className="btn-ghost mt-4 w-full py-2.5" onClick={reset}>
              {phase === "success" ? "New trade" : "Back to trade"}
            </button>
          )}
        </div>
      )}

      {market?.priceUsd != null && (
        <p className="num mt-4 border-t border-line/60 pt-3 text-[11px] text-muted">
          Market: 1 {symbol} = {fmtPrice(market.priceUsd)}
          {market.priceNative && market.topPair?.quoteSymbol === "SOL" ? ` · ${fmtPrice(market.priceNative, { dollar: false })} SOL` : ""}
        </p>
      )}
    </section>
  );
}

function SlippagePicker({
  slip,
  setSlip,
  custom,
  setCustom,
}: {
  slip: number | "auto";
  setSlip: (v: number | "auto") => void;
  custom: string;
  setCustom: (v: string) => void;
}) {
  const isCustom = slip !== "auto" && !SLIPPAGES.includes(slip);
  return (
    <fieldset className="mt-4">
      <legend className="label">Slippage tolerance</legend>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <button type="button" className={`chip ${slip === "auto" ? "chip-on" : ""}`} onClick={() => setSlip("auto")} aria-pressed={slip === "auto"}>
          Auto
        </button>
        {SLIPPAGES.map((b) => (
          <button key={b} type="button" className={`chip ${slip === b ? "chip-on" : ""}`} onClick={() => setSlip(b)} aria-pressed={slip === b}>
            {b / 100}%
          </button>
        ))}
        <span className={`chip ${isCustom ? "chip-on" : ""} pr-1`}>
          <label htmlFor="custom-slip" className="sr-only">Custom slippage percent</label>
          <input
            id="custom-slip"
            inputMode="decimal"
            placeholder="Custom"
            className="num w-14 bg-transparent text-xs outline-none placeholder:text-muted"
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              const pct = Number(e.target.value);
              if (Number.isFinite(pct) && pct > 0 && pct <= 50) setSlip(Math.round(pct * 100));
            }}
          />
          %
        </span>
      </div>
      {slip !== "auto" && slip > 500 && (
        <p className="mt-1.5 text-[11px] text-warn">High slippage: your trade can fill at a much worse price.</p>
      )}
    </fieldset>
  );
}

function QuoteBox(p: {
  loading: boolean;
  error: string | null;
  hasAmount: boolean;
  outNum: number | null;
  outSym: string;
  minOut: number | null;
  impact: number | null;
  impactLevel: "ok" | "high" | "severe";
  order: Order | null;
  networkLamports: number | null;
  routeLabels?: string[];
  auto: boolean;
}) {
  if (!p.hasAmount) return <p className="mt-4 text-xs text-muted">Enter an amount to get a live quote.</p>;
  if (p.error && !p.order)
    return <p className="mt-4 rounded-lg border border-down/30 bg-down/[0.07] px-3 py-2 text-xs text-down" role="alert">{p.error}</p>;
  if (!p.order) return <p className="label mt-4 animate-pulse">Finding the best route…</p>;
  return (
    <dl className="mt-4 space-y-1.5 rounded-lg border border-line bg-ink-2 p-3 text-xs">
      <Line k="You receive (est.)" v={p.outNum != null ? `${fmtNum(p.outNum, 6)} ${p.outSym}` : "—"} strong />
      <Line k="Minimum received" v={p.minOut != null ? `${fmtNum(p.minOut, 6)} ${p.outSym}` : p.auto ? "Auto (set by Jupiter)" : "—"} />
      <Line k="Price impact (est.)" v={p.impact != null ? `${p.impact.toFixed(2)}%` : "—"} tone={p.impactLevel === "ok" ? undefined : p.impactLevel === "high" ? "warn" : "down"} />
      <Line k="Fees" v={`Jupiter ${p.order.feeBps != null ? (p.order.feeBps / 100).toFixed(2) + "%" : "incl."} · ENCORE ${p.order.encorePlatformFeeBps ? (p.order.encorePlatformFeeBps / 100).toFixed(2) + "%" : "none"}`} />
      <Line k="Network" v={p.networkLamports != null ? `${fmtNum(p.networkLamports / 1e9, 6)} SOL` : "~0.000005 SOL + priority"} />
      {p.routeLabels && p.routeLabels.length > 0 && <Line k="Route" v={p.routeLabels.join(" → ")} />}
      {p.impactLevel !== "ok" && (
        <p className={`pt-1 ${p.impactLevel === "severe" ? "text-down" : "text-warn"}`}>
          {p.impactLevel === "severe" ? "Very high price impact. Liquidity is thin for this size." : "High price impact. Consider a smaller amount."}
        </p>
      )}
      {p.loading && <p className="label pt-1 normal-case tracking-normal">Refreshing quote…</p>}
    </dl>
  );
}

function Line({ k, v, strong, tone }: { k: string; v: string; strong?: boolean; tone?: "warn" | "down" }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className={`num text-right ${strong ? "font-bold text-bone" : "text-bone-dim"} ${tone === "warn" ? "!text-warn" : tone === "down" ? "!text-down" : ""}`}>{v}</dd>
    </div>
  );
}
