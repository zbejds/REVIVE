"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePoll } from "@/lib/client";
import { changeClass, fmtAge, fmtNum, fmtPct, fmtPrice, fmtUsd } from "@/lib/format";
import type { Category, RegistryToken, TokenListItem } from "@/lib/types";
import { Sparkline } from "./Sparkline";
import { TokenLogo } from "./TokenLogo";
import { ComingSoon } from "./Social";
import { VoteButton } from "./VoteButton";

type SortKey = "legend" | "votes" | "volume" | "liquidity" | "activity" | "oldest";

const SORTS: { id: SortKey; label: string }[] = [
  { id: "legend", label: "Historical relevance" },
  { id: "votes", label: "Community votes" },
  { id: "volume", label: "24h volume" },
  { id: "liquidity", label: "Liquidity" },
  { id: "activity", label: "Recent activity (24h trades)" },
  { id: "oldest", label: "Oldest pool first" },
];

const PLATFORMS = [
  { id: "all", label: "Any launch" },
  { id: "pump", label: "pump.fun" },
  { id: "raydium", label: "Raydium" },
  { id: "other", label: "Other / unverified" },
];

export function DiscoverView({
  categories,
  archived,
  otherChains,
}: {
  categories: Category[];
  archived: RegistryToken[];
  otherChains: { symbol: string; name: string; chain: string; blurb: string }[];
}) {
  const { data, error, reload } = usePoll<{ items: TokenListItem[]; votingOnline: boolean }>("/api/tokens?window=all", 60_000);
  const [cat, setCat] = useState<string>("all");
  const [platform, setPlatform] = useState("all");
  const [sort, setSort] = useState<SortKey>("legend");
  const [q, setQ] = useState("");

  const items = useMemo(() => {
    if (!data) return [];
    const query = q.trim().toLowerCase();
    const metric = (i: TokenListItem): number => {
      const m = i.market;
      switch (sort) {
        case "votes": return i.votes?.votes ?? -1;
        case "volume": return m?.volume24h ?? -1;
        case "liquidity": return m?.liquidityUsd ?? -1;
        case "activity": return m?.txns24h ? m.txns24h.buys + m.txns24h.sells : -1;
        case "oldest": return m?.firstPoolAt ? -m.firstPoolAt : -Infinity;
        default: return -i.token.legendRank;
      }
    };
    return data.items
      .filter((i) => cat === "all" || i.token.categories.includes(cat))
      .filter((i) => {
        const p = (i.token.launchPlatform ?? "").toLowerCase();
        if (platform === "pump") return p.includes("pump.fun");
        if (platform === "raydium") return p.includes("raydium");
        if (platform === "other") return !p.includes("pump.fun") && !p.includes("raydium");
        return true;
      })
      .filter((i) =>
        !query ||
        i.token.symbol.toLowerCase().includes(query) ||
        i.token.name.toLowerCase().includes(query) ||
        i.token.mint.toLowerCase() === query,
      )
      .sort((a, b) => metric(b) - metric(a));
  }, [data, cat, platform, sort, q]);

  return (
    <>
      <div className="mt-6 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Category">
          <button className={`chip ${cat === "all" ? "chip-on" : ""}`} onClick={() => setCat("all")} aria-pressed={cat === "all"}>
            All legends
          </button>
          {categories.map((c) => (
            <button key={c.id} className={`chip ${cat === c.id ? "chip-on" : ""}`} onClick={() => setCat(c.id)} aria-pressed={cat === c.id}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <label className="sr-only" htmlFor="discover-search">Search</label>
          <input
            id="discover-search"
            className="input"
            placeholder="Search by name, ticker or full mint address"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <label className="sr-only" htmlFor="discover-platform">Launch platform</label>
          <select id="discover-platform" className="input sm:w-44" value={platform} onChange={(e) => setPlatform(e.target.value)}>
            {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <label className="sr-only" htmlFor="discover-sort">Sort</label>
          <select id="discover-sort" className="input sm:w-60" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {SORTS.map((s) => (
              <option key={s.id} value={s.id} disabled={s.id === "votes" && data?.votingOnline === false}>
                Sort: {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && !data && (
        <p className="mt-6 text-sm text-down">
          Couldn&apos;t load the archive: {error} <button className="underline" onClick={() => void reload()}>Retry</button>
        </p>
      )}

      <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {!data && !error && Array.from({ length: 6 }).map((_, i) => <li key={i} className="panel h-[230px] animate-pulse" />)}
        {items.map((i) => <Card key={i.token.mint} item={i} onVoted={() => void reload()} />)}
        {data && <ComingSoon variant="card" />}
      </ul>
      {data && items.length === 0 && (
        <p className="panel mt-6 p-6 text-sm text-bone-dim">
          No listed token matches. ENCORE only lists tokens by verified mint, so unknown or look-alike tickers won&apos;t show up here.
        </p>
      )}

      <section className="mt-14" aria-labelledby="vault-title">
        <h2 id="vault-title" className="font-display text-xl font-bold">The vault</h2>
        <p className="mt-1 max-w-2xl text-sm text-bone-dim">
          Part of meme history, but not in the ENCORE market. Each one says why.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {archived.map((t) => (
            <li key={t.mint} className="rounded-xl border border-dashed border-line-strong p-4">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold">{t.symbol}</span>
                <span className="chip">{t.status === "migrated" ? "Migrated" : "Not listed"}</span>
              </div>
              <p className="mt-2 text-sm text-bone-dim">{t.blurb}</p>
              <p className="mt-2 text-xs leading-relaxed text-warn">{t.notListedReason}</p>
              <p className="num mt-2 break-all text-[11px] text-muted">Old mint: {t.mint}</p>
            </li>
          ))}
          {otherChains.map((t) => (
            <li key={t.symbol} className="rounded-xl border border-dashed border-line-strong p-4">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold">{t.symbol}</span>
                <span className="chip">{t.chain}</span>
              </div>
              <p className="mt-2 text-sm text-bone-dim">{t.name}. {t.blurb}</p>
              <p className="mt-2 text-xs text-muted">Not a Solana token, so it can&apos;t be voted on or traded on ENCORE.</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function Card({ item, onVoted }: { item: TokenListItem; onVoted: () => void }) {
  const { token, market, votes } = item;
  const href = `/token/${token.mint}`;
  return (
    <li className="panel flex flex-col p-4 transition hover:border-line-strong">
      <div className="flex items-start gap-3">
        <TokenLogo src={market?.imageUrl} symbol={token.symbol} size={44} />
        <div className="min-w-0 flex-1">
          <Link href={href} className="block truncate font-display text-lg font-bold hover:text-pulse">{token.symbol}</Link>
          <p className="truncate text-xs text-muted">{token.name}</p>
        </div>
        <div className="text-right">
          <p className="num text-sm">{fmtPrice(market?.priceUsd)}</p>
          <p className={`num text-xs ${changeClass(market?.change.h24)}`}>{fmtPct(market?.change.h24)}</p>
        </div>
      </div>
      <p className="label mt-3 normal-case tracking-normal text-ember/90">{token.era}</p>
      <p className="mt-1 line-clamp-2 text-sm leading-snug text-bone-dim">{token.blurb}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <dl className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs">
          <dt className="label text-[10px]">Age</dt>
          <dt className="label text-[10px]">Liq.</dt>
          <dt className="label text-[10px]">Votes</dt>
          <dd className="num" title="Time since the first trading pool we can see">{fmtAge(market?.firstPoolAt)}</dd>
          <dd className="num">{fmtUsd(market?.liquidityUsd)}</dd>
          <dd className="num">{votes ? fmtNum(votes.votes, 0) : "—"}</dd>
        </dl>
        <Sparkline mint={token.mint} width={110} height={34} />
      </div>
      <div className="mt-4 flex items-start justify-between gap-2 border-t border-line/60 pt-3">
        <Link href={href} className="btn-ghost px-3 py-1.5 text-xs">Open chart</Link>
        <VoteButton mint={token.mint} symbol={token.symbol} onVoted={onVoted} />
      </div>
    </li>
  );
}
