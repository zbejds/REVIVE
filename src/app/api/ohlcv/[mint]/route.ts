import { allow, clientIp, errorJson, json } from "@/lib/http";
import { getOhlcv, TIMEFRAMES } from "@/lib/ohlcv";
import { isListedMint } from "@/lib/registry";
import type { Timeframe } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ mint: string }> }) {
  try {
    const { mint } = await ctx.params;
    if (!isListedMint(mint)) return json({ error: "Token not listed on ENCORE." }, { status: 404 });
    if (!allow(`ohlcv:${clientIp(req) ?? "anon"}`, 90)) return json({ error: "Too many chart requests." }, { status: 429 });

    const sp = new URL(req.url).searchParams;
    const tf = (sp.get("tf") ?? "15m") as Timeframe;
    if (!TIMEFRAMES.includes(tf)) return json({ error: "Unsupported timeframe." }, { status: 400 });
    const limit = Number(sp.get("limit") ?? 500);
    const before = Number(sp.get("before") ?? 0) || undefined;

    return json(await getOhlcv(mint, tf, { limit, before }));
  } catch (e) {
    return errorJson(e);
  }
}
