import { env, features, platformFeeBps } from "@/lib/env";
import { allow, clientIp, json } from "@/lib/http";
import { isListedMint, isValidMint, SOL_MINT } from "@/lib/registry";

export const dynamic = "force-dynamic";

const JUP = "https://api.jup.ag/swap/v2";

/**
 * Proxies Jupiter Swap V2 /order. The API key stays on the server.
 * Only SOL <-> listed ENCORE token pairs are allowed.
 * Without `taker` Jupiter returns a quote only (no transaction).
 */
export async function GET(req: Request) {
  if (!features.trading)
    return json({ error: "Trading is not configured on this ENCORE deployment.", code: "trading_offline" }, { status: 503 });
  if (!allow(`order:${clientIp(req) ?? "anon"}`, 60))
    return json({ error: "Too many quote requests. Slow down a little.", code: "rate_limited" }, { status: 429 });

  const sp = new URL(req.url).searchParams;
  const inputMint = sp.get("inputMint") ?? "";
  const outputMint = sp.get("outputMint") ?? "";
  const amount = sp.get("amount") ?? "";
  const taker = sp.get("taker");
  const slippageBps = sp.get("slippageBps");

  const tokenSide = inputMint === SOL_MINT ? outputMint : outputMint === SOL_MINT ? inputMint : null;
  if (!tokenSide || !isListedMint(tokenSide))
    return json({ error: "ENCORE only routes SOL to listed tokens and back.", code: "pair_not_allowed" }, { status: 400 });
  if (!/^\d{1,20}$/.test(amount) || BigInt(amount) <= BigInt(0))
    return json({ error: "Enter an amount greater than zero.", code: "bad_amount" }, { status: 400 });
  if (taker && !isValidMint(taker)) return json({ error: "Invalid wallet address.", code: "bad_taker" }, { status: 400 });

  const qs = new URLSearchParams({ inputMint, outputMint, amount });
  if (taker) qs.set("taker", taker);
  if (slippageBps) {
    const s = Number(slippageBps);
    if (!Number.isInteger(s) || s < 1 || s > 5000)
      return json({ error: "Slippage must be between 0.01% and 50%.", code: "bad_slippage" }, { status: 400 });
    qs.set("slippageBps", String(s));
  }
  if (platformFeeBps > 0) {
    qs.set("referralAccount", env.jupiterReferralAccount);
    qs.set("referralFee", String(platformFeeBps));
  }

  let res: Response;
  try {
    res = await fetch(`${JUP}/order?${qs}`, {
      headers: { "x-api-key": env.jupiterApiKey, accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    return json({ error: "Jupiter didn't respond. The network may be congested; try again.", code: "jupiter_unreachable" }, { status: 504 });
  }
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !body) {
    const msg = String((body?.error as string) ?? (body?.message as string) ?? "");
    const noRoute = /route|liquidity|not tradable|no quote/i.test(msg) || res.status === 404;
    return json(
      {
        error: noRoute
          ? "No trading route is available for this amount right now. Liquidity may be too thin."
          : msg || `Jupiter returned an error (${res.status}).`,
        code: noRoute ? "no_route" : "jupiter_error",
      },
      { status: res.status === 429 ? 429 : 422 },
    );
  }

  // Pass through what the UI needs; read optional fields defensively.
  const pick = (k: string) => (k in body ? body[k] : undefined);
  return json({
    requestId: pick("requestId"),
    transaction: pick("transaction") ?? null,
    inAmount: pick("inAmount") ?? amount,
    outAmount: pick("outAmount"),
    otherAmountThreshold: pick("otherAmountThreshold"),
    priceImpactPct: pick("priceImpactPct") ?? pick("priceImpact"),
    slippageBps: pick("slippageBps"),
    router: pick("router"),
    mode: pick("mode"),
    feeBps: pick("feeBps"),
    feeMint: pick("feeMint"),
    platformFee: pick("platformFee"),
    signatureFeeLamports: pick("signatureFeeLamports"),
    prioritizationFeeLamports: pick("prioritizationFeeLamports"),
    rentFeeLamports: pick("rentFeeLamports"),
    lastValidBlockHeight: pick("lastValidBlockHeight"),
    routePlan: pick("routePlan"),
    errorCode: pick("errorCode"),
    errorMessage: pick("errorMessage"),
    encorePlatformFeeBps: platformFeeBps,
  });
}
