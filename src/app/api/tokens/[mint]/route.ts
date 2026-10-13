import { errorJson, json } from "@/lib/http";
import { getMarket } from "@/lib/market";
import { getToken, isListedMint } from "@/lib/registry";
import { getMintDecimals } from "@/lib/rpc";
import { getTokenCommunity, getVoteTable } from "@/lib/votes";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ mint: string }> }) {
  try {
    const { mint } = await ctx.params;
    const token = getToken(mint);
    if (!token || !isListedMint(mint)) return json({ error: "Token not listed on ENCORE." }, { status: 404 });

    const [market, decimals, table24, tableAll, community] = await Promise.all([
      getMarket(mint),
      getMintDecimals(mint),
      getVoteTable("24h").catch(() => null),
      getVoteTable("all").catch(() => null),
      getTokenCommunity(mint).catch(() => null),
    ]);

    return json({
      token,
      market,
      decimals,
      votes: table24 && tableAll ? { d24: table24.get(mint) ?? null, all: tableAll.get(mint) ?? null } : null,
      community,
      generatedAt: Date.now(),
    });
  } catch (e) {
    return errorJson(e);
  }
}
