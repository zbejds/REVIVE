import "server-only";
import { cached, fetchJson } from "./cache";
import { env } from "./env";
import { getMarket } from "./market";
import type { Candle, OhlcvResponse, Timeframe } from "./types";

const GT = "https://api.geckoterminal.com/api/v2";
const BE = "https://public-api.birdeye.so";

export const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "1d"];

const SECONDS: Record<Timeframe, number> = { "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400 };

// GeckoTerminal: timeframe + aggregate (minute 1/5/15, hour 1/4/12, day 1)
const GT_TF: Record<Timeframe, [string, number]> = {
  "1m": ["minute", 1],
  "5m": ["minute", 5],
  "15m": ["minute", 15],
  "1h": ["hour", 1],
  "4h": ["hour", 4],
  "1d": ["day", 1],
};
// Birdeye /defi/ohlcv type values
const BE_TF: Record<Timeframe, string> = { "1m": "1m", "5m": "5m", "15m": "15m", "1h": "1H", "4h": "4H", "1d": "1D" };

// How long a candle page stays fresh in cache.
const TTL: Record<Timeframe, number> = { "1m": 15_000, "5m": 30_000, "15m": 60_000, "1h": 120_000, "4h": 300_000, "1d": 600_000 };

function clean(rows: Candle[]): Candle[] {
  const byTime = new Map<number, Candle>();
  for (const c of rows) {
    if (![c.time, c.open, c.high, c.low, c.close].every((v) => Number.isFinite(v) && v >= 0)) continue;
    byTime.set(c.time, c);
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

async function fromGecko(mint: string, pool: string, tf: Timeframe, limit: number, before?: number) {
  const [unit, agg] = GT_TF[tf];
  const qs = new URLSearchParams({
    aggregate: String(agg),
    limit: String(Math.min(limit, 1000)),
    currency: "usd",
    token: mint, // price the chart in OUR token even if it is the pool's quote side
  });
  if (before) qs.set("before_timestamp", String(before));
  type R = { data?: { attributes?: { ohlcv_list?: [number, number, number, number, number, number][] } } };
  const r = await fetchJson<R>("geckoterminal", `${GT}/networks/solana/pools/${pool}/ohlcv/${unit}?${qs}`, {
    headers: { accept: "application/json;version=20230302" },
  });
  const list = r.data?.attributes?.ohlcv_list ?? [];
  return clean(list.map(([t, o, h, l, c, v]) => ({ time: t, open: o, high: h, low: l, close: c, volume: v })));
}

async function fromBirdeye(mint: string, tf: Timeframe, limit: number, before?: number) {
  const to = before ?? Math.floor(Date.now() / 1000);
  const from = to - SECONDS[tf] * Math.min(limit, 1000);
  const qs = new URLSearchParams({ address: mint, type: BE_TF[tf], time_from: String(from), time_to: String(to) });
  type R = { success?: boolean; data?: { items?: { unixTime: number; o: number; h: number; l: number; c: number; v: number }[] } };
  const r = await fetchJson<R>("birdeye", `${BE}/defi/ohlcv?${qs}`, {
    headers: { "X-API-KEY": env.birdeyeApiKey, "x-chain": "solana" },
  });
  const items = r.data?.items ?? [];
  return clean(items.map((i) => ({ time: i.unixTime, open: i.o, high: i.h, low: i.l, close: i.c, volume: i.v })));
}

export async function getOhlcv(
  mint: string,
  tf: Timeframe,
  opts: { limit?: number; before?: number } = {},
): Promise<OhlcvResponse> {
  const limit = Math.max(10, Math.min(opts.limit ?? 500, 1000));
  const before = opts.before && opts.before > 0 ? Math.floor(opts.before) : undefined;
  const useBirdeye = Boolean(env.birdeyeApiKey);

  // Chart the deepest pool so candles reflect where the token actually trades.
  const market = await getMarket(mint);
  const pool = market?.topPair?.pairAddress ?? null;

  if (!useBirdeye && !pool) {
    return {
      mint, timeframe: tf, source: "geckoterminal", pool: null, candles: [], earliest: null,
      hasMore: false, fetchedAt: Date.now(), note: "No active trading pool found for this token.",
    };
  }

  const key = `ohlcv:${useBirdeye ? "be" : "gt"}:${mint}:${pool}:${tf}:${limit}:${before ?? "now"}`;
  const { value, storedAt, stale } = await cached(
    key,
    // Older pages never change; small 1h pages are card sparklines and can be 10 min old.
    before ? 3_600_000 : tf === "1h" && limit <= 60 ? 600_000 : TTL[tf],
    () => (useBirdeye ? fromBirdeye(mint, tf, limit, before) : fromGecko(mint, pool!, tf, limit, before)),
    { staleMs: 5 * 60_000 },
  );

  return {
    mint,
    timeframe: tf,
    source: useBirdeye ? "birdeye" : "geckoterminal",
    pool,
    candles: value,
    earliest: value.length ? value[0].time : null,
    hasMore: value.length >= limit - 1,
    fetchedAt: storedAt,
    note: stale ? "Provider is rate limited; showing the most recent cached candles." : undefined,
  };
}
