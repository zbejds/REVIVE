import data from "../../data/registry.json";
import type { Category, RegistryToken } from "./types";

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export const categories: Category[] = data.categories;

export const allTokens: RegistryToken[] = (data.tokens as RegistryToken[]).map((t) => ({
  ...t,
  launchPlatform: t.launchPlatform ?? null,
}));

/** Tokens in the ENCORE market: Solana, listed, valid mint, no duplicates. */
export const listedTokens: RegistryToken[] = (() => {
  const seenMint = new Set<string>();
  const out: RegistryToken[] = [];
  for (const t of allTokens) {
    if (t.chain !== "solana" || !t.listed || !BASE58.test(t.mint)) continue;
    if (seenMint.has(t.mint)) continue; // duplicate listing guard
    seenMint.add(t.mint);
    out.push(t);
  }
  return out;
})();

export const archivedTokens: RegistryToken[] = allTokens.filter((t) => !listedTokens.includes(t));

export const otherChainTokens: { symbol: string; name: string; chain: string; blurb: string }[] = data.otherChains;

const byMint = new Map(allTokens.map((t) => [t.mint, t]));

export function getToken(mint: string): RegistryToken | undefined {
  return byMint.get(mint);
}

export function isListedMint(mint: string): boolean {
  return listedTokens.some((t) => t.mint === mint);
}

export function isValidMint(s: string): boolean {
  return BASE58.test(s);
}

export function categoryLabel(id: string): string {
  return categories.find((c) => c.id === id)?.label ?? id;
}

/** Tokens sharing the most categories with the given one. */
export function relatedTokens(mint: string, n = 4): RegistryToken[] {
  const t = getToken(mint);
  if (!t) return [];
  return listedTokens
    .filter((o) => o.mint !== mint)
    .map((o) => ({ o, score: o.categories.filter((c) => t.categories.includes(c)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.o.legendRank - b.o.legendRank)
    .slice(0, n)
    .map((x) => x.o);
}

export const SOL_MINT = "So11111111111111111111111111111111111111112";
