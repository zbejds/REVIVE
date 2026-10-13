import { env, features } from "@/lib/env";
import { allow, clientIp, json } from "@/lib/http";

export const dynamic = "force-dynamic";

const JUP = "https://api.jup.ag/swap/v2";

const CODE_MESSAGES: Record<string, string> = {
  "-1": "The quote expired before it was sent. Get a new quote and try again.",
  "-1000": "The transaction didn't land on-chain. The network may be congested; try again.",
  "-2003": "The quote expired. Get a new quote and try again.",
};

/** Proxies Jupiter Swap V2 /execute with a wallet-signed transaction. */
export async function POST(req: Request) {
  if (!features.trading)
    return json({ error: "Trading is not configured on this ENCORE deployment.", code: "trading_offline" }, { status: 503 });
  if (!allow(`execute:${clientIp(req) ?? "anon"}`, 20))
    return json({ error: "Too many swap submissions. Wait a moment.", code: "rate_limited" }, { status: 429 });

  const b = (await req.json().catch(() => ({}))) as { signedTransaction?: string; requestId?: string };
  if (!b.signedTransaction || !/^[A-Za-z0-9+/=]+$/.test(b.signedTransaction) || b.signedTransaction.length > 4000)
    return json({ error: "Missing or malformed signed transaction.", code: "bad_tx" }, { status: 400 });
  if (!b.requestId || typeof b.requestId !== "string")
    return json({ error: "Missing request id.", code: "bad_request" }, { status: 400 });

  let res: Response;
  try {
    res = await fetch(`${JUP}/execute`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": env.jupiterApiKey },
      body: JSON.stringify({ signedTransaction: b.signedTransaction, requestId: b.requestId }),
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    return json(
      { error: "No answer from Jupiter while sending. Check the explorer before retrying so you don't trade twice.", code: "execute_timeout" },
      { status: 504 },
    );
  }
  const body = (await res.json().catch(() => null)) as
    | { status?: string; signature?: string; code?: number; error?: string; totalInputAmount?: string; totalOutputAmount?: string; inputAmountResult?: string; outputAmountResult?: string }
    | null;
  if (!body) return json({ error: `Jupiter returned ${res.status}.`, code: "jupiter_error" }, { status: 502 });

  const ok = body.status === "Success" && body.signature;
  return json(
    {
      status: ok ? "submitted" : "failed",
      signature: body.signature ?? null,
      code: body.code ?? null,
      error: ok ? null : CODE_MESSAGES[String(body.code)] ?? body.error ?? "The swap failed.",
      inputAmount: body.totalInputAmount ?? body.inputAmountResult ?? null,
      outputAmount: body.totalOutputAmount ?? body.outputAmountResult ?? null,
    },
    { status: ok ? 200 : 422 },
  );
}
