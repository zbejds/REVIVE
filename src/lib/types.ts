export type VoteWindow = "24h" | "7d" | "all";

export type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export interface RegistryToken {
  mint: string;
  symbol: string;
  name: string;
  chain: string;
  listed: boolean;
  status?: string;
  launchPlatform: string | null;
  era: string;
  categories: string[];
  legendRank: number;
  blurb: string;
  notListedReason?: string;
}

export interface Category {
  id: string;
  label: string;
}

/** Venue of a pool, normalized from DexScreener's dexId. */
export type Venue =
  | "pumpfun-curve"
  | "pumpswap"
  | "raydium"
  | "meteora"
  | "orca"
  | "other";

export interface PairInfo {
  pairAddress: string;
  dexId: string;
  venue: Venue;
  venueLabel: string;
  labels: string[];
  quoteSymbol: string | null;
  quoteMint: string | null;
  priceUsd: number | null;
  liquidityUsd: number | null;
  volume24h: number | null;
  pairCreatedAt: number | null;
  url: string;
}

export interface MarketData {
  mint: string;
  priceUsd: number | null;
  priceNative: number | null;
  change: { m5: number | null; h1: number | null; h6: number | null; h24: number | null };
  volume24h: number | null;
  liquidityUsd: number | null;
  marketCap: number | null;
  fdv: number | null;
  txns24h: { buys: number; sells: number } | null;
  imageUrl: string | null;
  topPair: PairInfo | null;
  pairs: PairInfo[];
  firstPoolAt: number | null;
  websites: { label: string; url: string }[];
  socials: { platform: string; url: string }[];
  source: "dexscreener";
  fetchedAt: number;
  /** True when served from the stored snapshot because the provider was unavailable. */
  stale: boolean;
}

export interface VoteStats {
  votes: number;
  rank: number | null;
}

export interface TokenListItem {
  token: RegistryToken;
  market: MarketData | null;
  votes: VoteStats | null;
}

export interface Candle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OhlcvResponse {
  mint: string;
  timeframe: Timeframe;
  source: "geckoterminal" | "birdeye";
  pool: string | null;
  candles: Candle[];
  earliest: number | null;
  /** Older candles may exist beyond this page. */
  hasMore: boolean;
  fetchedAt: number;
  note?: string;
}

export interface HealthStatus {
  voting: boolean;
  trading: boolean;
  rpc: "custom" | "public";
  charts: "birdeye" | "geckoterminal";
  platformFeeBps: number;
  minVoterSol: number;
}
