"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePoll } from "@/lib/client";
import { changeClass, fmtAge, fmtAgo, fmtDate, fmtNum, fmtPct, fmtPrice, fmtUsd, shortAddr } from "@/lib/format";
import type { MarketData, RegistryToken, VoteStats } from "@/lib/types";
import { PriceChart } from "./PriceChart";
import { TokenLogo } from "./TokenLogo";
import { TradePanel } from "./TradePanel";
import { VoteButton } from "./VoteButton";

interface Detail {
  token: RegistryToken;
  market: MarketData | null;
  decimals: number | null;
  votes: { d24: VoteStats | null; all: VoteStats | null } | null;
  community: {
    recent: { wallet: string; at: number }[];
    daily: { day: string; votes: number }[];
    totals: { all: number; d1: number; d7: number; voters: number };
  } | null;
  generatedAt: number;
}

export function TokenView({
  token,
  categoryLabels,
  related,
}: {
  token: RegistryToken;
  categoryLabels: string[];
  related: { mint: string; symbol: string; name: string; era: string }[];
}) {
  const { data, error, reload } = usePoll<Detail>(`/api/tokens/${token.mint}`, 20_000);
  const m = data?.market ?? null;
  const isDesktop = useIsDesktop();
  // One trade panel only: beside the chart on desktop, right under it on mobile.
  const trade = <TradePanel mint={token.mint} symbol={token.symbol} decimals={data?.decimals ?? null} market={m} />;

  return (
    <div className="mt-6">
      <nav className="label normal-case tracking-normal" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-bone">Leaderboard</Link> <span aria-hidden="true">/</span>{" "}
        <Link href="/discover" className="hover:text-bone">Discover</Link> <span aria-hidden="true">/</span>{" "}
        <span className="text-bone-dim">{token.symbol}</span>
      </nav>

      <TokenHeader token={token} data={data} categoryLabels={categoryLabels} onVoted={() => void reload()} />

      {error && !data && <p className="mt-4 text-sm text-down">Couldn&apos;t load live data: {error}</p>}
      {m?.stale && (
        <p className="mt-4 rounded-lg border border-warn/25 bg-warn/[0.06] px-3 py-2 text-xs text-warn">
          Market provider is unavailable. Showing the last saved snapshot from {fmtAgo(m.fetchedAt)}; these numbers are not live.
        </p>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-5">
          <PriceChart mint={token.mint} symbol={token.symbol} />
          {!isDesktop && trade}
          <MarketStats m={m} loading={!data} />
          <Pairs m={m} />
          <Community data={data} token={token} related={related} />
        </div>
        {isDesktop && (
          <aside>
            <div className="sticky top-20 flex flex-col gap-4">{trade}</div>
          </aside>
        )}
      </div>
    </div>
  );
}

function useIsDesktop() {
  const [desk, setDesk] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setDesk(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return desk;
}

function TokenHeader({
  token,
  data,
  categoryLabels,
  onVoted,
}: {
  token: RegistryToken;
  data: Detail | null;
  categoryLabels: string[];
  onVoted: () => void;
}) {
  const m = data?.market;
  const [copied, setCopied] = useState(false);
  const rank = data?.votes?.d24?.rank;
  const allVotes = data?.votes?.all?.votes;

  return (
    <header className="ring-grad relative mt-4 grid gap-5 overflow-hidden rounded-[28px] border border-white/[0.06] bg-black/30 p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-end">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/art/sphere.webp"
        alt=""
        className="brand-tint pointer-events-none absolute -right-24 -top-10 h-[130%] w-auto max-w-none opacity-35 sm:-right-10 lg:opacity-45"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-ink/95 via-ink/70 to-transparent" />
      <div className="relative flex min-w-0 items-start gap-4">
        <TokenLogo src={m?.imageUrl} symbol={token.symbol} size={64} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="font-display text-3xl font-black tracking-tight sm:text-4xl">{token.symbol}</h1>
            <span className="text-bone-dim">{token.name}</span>
            <span className="chip">Solana</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="label normal-case tracking-normal">Mint</span>
            <code className="num rounded bg-panel-2 px-1.5 py-0.5 text-bone-dim" title={token.mint}>
              <span className="hidden sm:inline">{token.mint}</span>
              <span className="sm:hidden">{shortAddr(token.mint, 6)}</span>
            </code>
            <button
              className="rounded px-1.5 py-0.5 text-muted hover:text-bone"
              onClick={() =>
                navigator.clipboard?.writeText(token.mint).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }).catch(() => {})
              }
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <a className="text-pulse hover:underline" href={`https://solscan.io/token/${token.mint}`} target="_blank" rel="noreferrer">Solscan ↗</a>
            {m?.topPair && (
              <a className="text-pulse hover:underline" href={m.topPair.url} target="_blank" rel="noreferrer">DexScreener ↗</a>
            )}
            <a className="text-pulse hover:underline" href={`https://www.geckoterminal.com/solana/tokens/${token.mint}`} target="_blank" rel="noreferrer">GeckoTerminal ↗</a>
            {m?.websites.slice(0, 2).map((w) => (
              <a key={w.url} className="text-bone-dim hover:text-bone" href={w.url} target="_blank" rel="noreferrer nofollow">{w.label} ↗</a>
            ))}
            {m?.socials.slice(0, 2).map((s) => (
              <a key={s.url} className="text-bone-dim capitalize hover:text-bone" href={s.url} target="_blank" rel="noreferrer nofollow">{s.platform} ↗</a>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="chip text-ember/90">{token.era}</span>
            <span className="chip">Launch: {token.launchPlatform ?? "Unverified"}</span>
            <span className="chip" title="Time since the first trading pool we can see">Age: {fmtAge(m?.firstPoolAt)}</span>
            {categoryLabels.map((c) => <span key={c} className="chip">{c}</span>)}
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-bone-dim">{token.blurb}</p>
        </div>
      </div>

      <div className="relative flex flex-wrap items-end gap-5 lg:flex-col lg:items-end">
        <div className="lg:text-right">
          <p className="num text-3xl font-bold">{m ? fmtPrice(m.priceUsd) : data ? "No market" : "…"}</p>
          <p className={`num text-sm ${changeClass(m?.change.h24)}`}>{fmtPct(m?.change.h24)} <span className="text-muted">24h</span></p>
        </div>
        <div className="flex items-end gap-4">
          <div className="text-right">
            <p className="label">ENCORE rank · 24h</p>
            <p className="num text-xl font-bold text-pulse">{data?.votes ? (rank ? `#${rank}` : "Unranked") : "—"}</p>
            <p className="num text-[11px] text-muted">{allVotes != null ? `${allVotes.toLocaleString()} votes all-time` : "Voting offline"}</p>
          </div>
          <VoteButton mint={token.mint} symbol={token.symbol} size="lg" onVoted={onVoted} />
        </div>
      </div>
    </header>
  );
}

function MarketStats({ m, loading }: { m: MarketData | null; loading: boolean }) {
  const stats: { k: string; v: string; hint?: string }[] = [
    { k: "Market cap", v: fmtUsd(m?.marketCap), hint: "Circulating market cap as reported by DexScreener" },
    { k: "FDV", v: fmtUsd(m?.fdv), hint: "Fully diluted valuation" },
    { k: "Liquidity", v: fmtUsd(m?.liquidityUsd), hint: "Summed across all Solana pools for this mint" },
    { k: "Volume 24h", v: fmtUsd(m?.volume24h), hint: "Summed across all Solana pools for this mint" },
    { k: "Trades 24h", v: m?.txns24h ? fmtNum(m.txns24h.buys + m.txns24h.sells, 0) : "—" },
    { k: "Buys / sells", v: m?.txns24h ? `${fmtNum(m.txns24h.buys, 0)} / ${fmtNum(m.txns24h.sells, 0)}` : "—" },
    { k: "1h change", v: fmtPct(m?.change.h1) },
    { k: "First pool", v: fmtDate(m?.firstPoolAt), hint: "Earliest pool creation we can see; launch may predate it" },
  ];
  return (
    <section aria-labelledby="stats-title" className="panel p-4">
      <div className="flex items-baseline justify-between">
        <h2 id="stats-title" className="font-display text-base font-bold">Market statistics</h2>
        {m && <span className="label normal-case tracking-normal">DexScreener · {fmtAgo(m.fetchedAt)}</span>}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.k} className="bg-panel p-3" title={s.hint}>
            <dt className="label">{s.k}</dt>
            <dd className={`num mt-1 text-base font-bold ${loading ? "animate-pulse text-muted" : ""}`}>{loading ? "…" : s.v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[11px] text-muted">Unique trader counts aren&apos;t provided by our free data sources, so ENCORE doesn&apos;t show them.</p>
    </section>
  );
}

function Pairs({ m }: { m: MarketData | null }) {
  if (!m?.pairs.length) return null;
  return (
    <section aria-labelledby="pairs-title" className="panel overflow-hidden">
      <h2 id="pairs-title" className="px-4 pt-4 font-display text-base font-bold">Pools &amp; trading pairs</h2>
      <p className="px-4 pt-1 text-xs text-muted">Sorted by liquidity. The top pool drives the chart and the venue shown in the trade panel.</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-y border-line text-left">
              {["Pair", "Venue", "Price", "Liquidity", "Volume 24h", "Created", ""].map((h) => (
                <th key={h} className="label px-4 py-2 font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {m.pairs.map((p, i) => (
              <tr key={p.pairAddress} className="border-b border-line/60 last:border-0">
                <td className="px-4 py-2.5">
                  <span className="font-semibold">{m.topPair?.pairAddress === p.pairAddress ? "★ " : ""}/{p.quoteSymbol ?? "?"}</span>
                  <span className="num ml-2 text-[11px] text-muted">{shortAddr(p.pairAddress)}</span>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`chip ${p.venue === "pumpfun-curve" ? "border-ember/40 text-ember" : ""}`}>{p.venueLabel}</span>
                </td>
                <td className="num px-4 py-2.5">{fmtPrice(p.priceUsd)}</td>
                <td className="num px-4 py-2.5">{fmtUsd(p.liquidityUsd)}</td>
                <td className="num px-4 py-2.5">{fmtUsd(p.volume24h)}</td>
                <td className="num px-4 py-2.5 text-bone-dim">{fmtDate(p.pairCreatedAt)}</td>
                <td className="px-4 py-2.5 text-right">
                  <a href={p.url} target="_blank" rel="noreferrer" className="text-xs text-pulse hover:underline" aria-label={`Open pair ${i + 1} on DexScreener`}>↗</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Community({
  data,
  token,
  related,
}: {
  data: Detail | null;
  token: RegistryToken;
  related: { mint: string; symbol: string; name: string; era: string }[];
}) {
  const c = data?.community;
  const max = c ? Math.max(1, ...c.daily.map((d) => d.votes)) : 1;
  return (
    <section aria-labelledby="community-title" className="grid gap-5 md:grid-cols-[1.3fr_1fr]">
      <div className="panel p-4">
        <h2 id="community-title" className="font-display text-base font-bold">Community</h2>
        {!c ? (
          <p className="mt-3 text-sm text-bone-dim">{data ? "Voting is offline on this deployment, so there's no community activity to show." : "Loading…"}</p>
        ) : (
          <>
            <dl className="mt-3 grid grid-cols-4 gap-3">
              {[
                ["24h", c.totals.d1],
                ["7 days", c.totals.d7],
                ["All time", c.totals.all],
                ["Voters", c.totals.voters],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <dt className="label">{k}</dt>
                  <dd className="num mt-0.5 text-lg font-bold">{(v as number).toLocaleString()}</dd>
                </div>
              ))}
            </dl>

            <p className="label mt-5">Interest over time · votes per day, last 14 days (UTC)</p>
            <div className="mt-2 flex h-24 items-end gap-1" role="img" aria-label={`Daily votes for ${token.symbol} over 14 days`}>
              {c.daily.map((d) => (
                <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end">
                  <div
                    className={`w-full rounded-t ${d.votes ? "bg-pulse/70 group-hover:bg-pulse" : "bg-line"}`}
                    style={{ height: `${Math.max(3, (d.votes / max) * 100)}%` }}
                  />
                  <span className="num pointer-events-none absolute -top-5 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-panel-3 px-1.5 text-[10px] group-hover:block">
                    {d.votes} · {d.day.slice(5)}
                  </span>
                </div>
              ))}
            </div>
            <div className="num mt-1 flex justify-between text-[10px] text-muted">
              <span>{c.daily[0]?.day.slice(5)}</span>
              <span>today</span>
            </div>

            <p className="label mt-5">Recent votes</p>
            {c.recent.length === 0 ? (
              <p className="mt-2 text-sm text-bone-dim">No votes yet. Be the first to bring {token.symbol} back.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line/60">
                {c.recent.map((r, i) => (
                  <li key={i} className="flex items-center justify-between py-1.5 text-xs">
                    <a className="num text-bone-dim hover:text-bone" href={`https://solscan.io/account/${r.wallet}`} target="_blank" rel="noreferrer">
                      {shortAddr(r.wallet)}
                    </a>
                    <span className="text-muted">{fmtAgo(r.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="panel p-4">
        <h2 className="font-display text-base font-bold">Related forgotten memecoins</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {related.map((r) => (
            <li key={r.mint}>
              <Link href={`/token/${r.mint}`} className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5 transition hover:border-pulse/50">
                <span>
                  <span className="font-display text-sm font-bold">{r.symbol}</span>
                  <span className="ml-2 text-xs text-muted">{r.name}</span>
                </span>
                <span className="text-[11px] text-ember/80">{r.era.split(" · ")[0]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
