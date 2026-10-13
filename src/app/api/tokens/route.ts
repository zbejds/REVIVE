import { errorJson, json } from "@/lib/http";
import { getMarkets } from "@/lib/market";
import { listedTokens } from "@/lib/registry";
import type { TokenListItem, VoteWindow } from "@/lib/types";
import { getVoteTable } from "@/lib/votes";

export const dynamic = "force-dynamic";

const WINDOWS: VoteWindow[] = ["24h", "7d", "all"];

export async function GET(req: Request) {
  try {
    const w = new URL(req.url).searchParams.get("window") as VoteWindow | null;
    const window: VoteWindow = w && WINDOWS.includes(w) ? w : "24h";
    const [markets, votes] = await Promise.all([
      getMarkets(listedTokens.map((t) => t.mint)),
      getVoteTable(window).catch((e) => {
        console.error("[votes] table failed:", e);
        return null;
      }),
    ]);
    const items: TokenListItem[] = listedTokens.map((token) => ({
      token,
      market: markets.get(token.mint) ?? null,
      votes: votes?.get(token.mint) ?? null,
    }));
    return json({ window, votingOnline: votes !== null, items, generatedAt: Date.now() });
  } catch (e) {
    return errorJson(e);
  }
}
