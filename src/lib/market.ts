import "server-only";
import { cached, fetchJson } from "./cache";
import { db } from "./db";
import type { MarketData, PairInfo, Venue } from "./types";

const DS = "https://api.dexscreener.com";

interface DsPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  labels?: string[] | null;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string } | null;
  priceNative?: string;
  priceUsd?: string | null;
  txns?: Record<string, { buys: number; sells: number }>;
  volume?: Record<string, number>;
  priceChange?: Record<string, number> | null;
  liquidity?: { usd?: number | null; base?: number; quote?: number } | null;
  fdv?: number | null;
  marketCap?: number | null;
  pairCreatedAt?: number | null;
  info?: {
    imageUrl?: string | null;
    websites?: { label?: string; url: string }[] | null;
    socials?: { platform?: string; type?: string; url?: string; handle?: string }[] | null;
  };
}

export function venueOf(dexId: string, labels: string[] = []): { venue: Venue; label: string } {
  const d = dexId.toLowerCase();
  if (d === "pumpfun" || d === "pump.fun") return { venue: "pumpfun-curve", label: "pump.fun bonding curve" };
  if (d.includes("pumpswap")) return { venue: "pumpswap", label: "PumpSwap" };
  if (d.startsWith("raydium")) {
    const v = labels.find((l) => /clmm|cpmm|amm|launchlab/i.test(l));
    return { venue: "raydium", label: v ? `Raydium ${v.toUpperCase()}` : "Raydium" };
  }
  if (d.startsWith("meteora")) return { venue: "meteora", label: labels[0] ? `Meteora ${labels[0].toUpperCase()}` : "Meteora" };
  if (d.startsWith("orca")) return { venue: "orca", label: "Orca" };
  return { venue: "other", label: dexId.charAt(0).toUpperCase() + dexId.slice(1) };
}

const n = (v: unknown): number | null => {
  const x = typeof v === "string" ? Number(v) : (v as number);
  return typeof x === "number" && Number.isFinite(x) ? x : null;
};

function toPair(p: DsPair): PairInfo {
  const { venue, label } = venueOf(p.dexId, p.labels ?? []);
  return {
    pairAddress: p.pairAddress,
    dexId: p.dexId,
    venue,
    venueLabel: label,
    labels: p.labels ?? [],
    quoteSymbol: p.quoteToken?.symbol ?? null,
    quoteMint: p.quoteToken?.address ?? null,
    priceUsd: n(p.priceUsd),
    liquidityUsd: n(p.liquidity?.usd),
    volume24h: n(p.volume?.h24),
    pairCreatedAt: n(p.pairCreatedAt),
    url: p.url,
  };
}

/**
 * Build one token's market picture from all of its Solana pairs.
 * Only pairs whose base token IS this mint are used for price, which keeps
 * look-alike tokens and inverted pools out of the numbers.
 */
function aggregate(mint: string, raw: DsPair[]): MarketData | null {
  const pairs = raw.filter((p) => p.chainId === "solana" && p.baseToken?.address === mint);
  if (!pairs.length) return null;
  const sorted = [...pairs].sort((a, b) => (n(b.liquidity?.usd) ?? 0) - (n(a.liquidity?.usd) ?? 0));
  const top = sorted[0];
  const sum = (f: (p: DsPair) => number | null) =>
    pairs.reduce<number | null>((acc, p) => {
      const v = f(p);
      return v == null ? acc : (acc ?? 0) + v;
    }, null);
  const buys = pairs.reduce((a, p) => a + (p.txns?.h24?.buys ?? 0), 0);
  const sells = pairs.reduce((a, p) => a + (p.txns?.h24?.sells ?? 0), 0);
  const created = pairs.map((p) => n(p.pairCreatedAt)).filter((x): x is number => x != null);
  const withInfo = sorted.find((p) => p.info?.imageUrl) ?? top;

  return {
    mint,
    priceUsd: n(top.priceUsd),
    priceNative: n(top.priceNative),
    change: {
      m5: n(top.priceChange?.m5),
      h1: n(top.priceChange?.h1),
      h6: n(top.priceChange?.h6),
      h24: n(top.priceChange?.h24),
    },
    volume24h: sum((p) => n(p.volume?.h24)),
    liquidityUsd: sum((p) => n(p.liquidity?.usd)),
    marketCap: n(top.marketCap),
    fdv: n(top.fdv),
    txns24h: pairs.some((p) => p.txns?.h24) ? { buys, sells } : null,
    imageUrl: withInfo.info?.imageUrl ?? null,
    topPair: toPair(top),
    pairs: sorted.slice(0, 12).map(toPair),
    firstPoolAt: created.length ? Math.min(...created) : null,
    websites: (withInfo.info?.websites ?? [])
      .filter((w) => w?.url?.startsWith("https://"))
      .map((w) => ({ label: w.label || "Website", url: w.url })),
    socials: (withInfo.info?.socials ?? [])
      .map((s) => ({ platform: s.platform || s.type || "social", url: s.url || "" }))
      .filter((s) => s.url.startsWith("https://")),
    source: "dexscreener",
    fetchedAt: Date.now(),
    stale: false,
  };
}

async function saveSnapshots(list: MarketData[]) {
  const pool = db();
  if (!pool || !list.length) return;
  try {
    for (const m of list) {
      await pool.query(
        `INSERT INTO market_snapshots (mint, payload, source, fetched_at)
         VALUES ($1, $2, 'dexscreener', to_timestamp($3 / 1000.0))
         ON CONFLICT (mint) DO UPDATE SET payload = EXCLUDED.payload, fetched_at = EXCLUDED.fetched_at`,
        [m.mint, JSON.stringify(m), m.fetchedAt],
      );
      for (const p of m.pairs) {
        await pool.query(
          `INSERT INTO pairs (pair_address, mint, dex_id, quote_mint, quote_symbol, liquidity_usd, pair_created_at, last_seen_at)
           VALUES ($1,$2,$3,$4,$5,$6, CASE WHEN $7::bigint IS NULL THEN NULL ELSE to_timestamp($7::bigint / 1000.0) END, now())
           ON CONFLICT (pair_address) DO UPDATE SET liquidity_usd = EXCLUDED.liquidity_usd, last_seen_at = now()`,
          [p.pairAddress, m.mint, p.dexId, p.quoteMint, p.quoteSymbol, p.liquidityUsd, p.pairCreatedAt],
        );
      }
    }
  } catch (e) {
    console.warn("[market] snapshot save failed:", (e as Error).message);
  }
}

async function loadSnapshots(mints: string[]): Promise<Map<string, MarketData>> {
  const out = new Map<string, MarketData>();
  const pool = db();
  if (!pool) return out;
  try {
    const { rows } = await pool.query(`SELECT mint, payload FROM market_snapshots WHERE mint = ANY($1)`, [mints]);
    for (const r of rows) out.set(r.mint, { ...(r.payload as MarketData), stale: true });
  } catch {
    /* ignore */
  }
  return out;
}

/** Market data for many mints (DexScreener /tokens/v1, 30 addresses per call). */
export async function getMarkets(mints: string[]): Promise<Map<string, MarketData>> {
  const out = new Map<string, MarketData>();
  const chunks: string[][] = [];
  for (let i = 0; i < mints.length; i += 30) chunks.push(mints.slice(i, i + 30));
  const failed: string[] = [];

  await Promise.all(
    chunks.map(async (chunk) => {
      const key = `ds:tokens:${chunk.join(",")}`;
      try {
        const { value, stale } = await cached(key, 30_000, async () => {
          const raw = await fetchJson<DsPair[]>("dexscreener", `${DS}/tokens/v1/solana/${chunk.join(",")}`);
          const list = chunk.map((m) => aggregate(m, raw)).filter((x): x is MarketData => !!x);
          void saveSnapshots(list);
          return list;
        });
        for (const m of value) out.set(m.mint, stale ? { ...m, stale: true } : m);
      } catch (e) {
        console.warn("[market] dexscreener batch failed:", (e as Error).message);
        failed.push(...chunk);
      }
    }),
  );

  if (failed.length) {
    const snaps = await loadSnapshots(failed);
    snaps.forEach((v, k) => out.set(k, v));
  }
  return out;
}

/** Full pair list for one token (DexScreener /token-pairs/v1). */
export async function getMarket(mint: string): Promise<MarketData | null> {
  try {
    const { value, stale } = await cached(`ds:pairs:${mint}`, 20_000, async () => {
      const raw = await fetchJson<DsPair[]>("dexscreener", `${DS}/token-pairs/v1/solana/${mint}`);
      const m = aggregate(mint, raw);
      if (m) void saveSnapshots([m]);
      return m;
    });
    return value && stale ? { ...value, stale: true } : value;
  } catch (e) {
    console.warn("[market] dexscreener token failed:", (e as Error).message);
    const snaps = await loadSnapshots([mint]);
    return snaps.get(mint) ?? null;
  }
}
