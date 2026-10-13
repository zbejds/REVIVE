import { env } from "@/lib/env";
import { allow, clientIp, json } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Read-mostly Solana RPC proxy so a private RPC key never reaches the browser.
 * Only the methods ENCORE's UI needs are allowed. Sending transactions goes
 * through Jupiter /execute, not here.
 */
const ALLOWED = new Set([
  "getBalance",
  "getTokenAccountsByOwner",
  "getSignatureStatuses",
  "simulateTransaction",
  "getLatestBlockhash",
  "getAccountInfo",
  "getBlockHeight",
  "getGenesisHash",
  "getVersion",
  "getSlot",
  "getEpochInfo",
]);

export async function POST(req: Request) {
  if (!allow(`rpc:${clientIp(req) ?? "anon"}`, 120))
    return json({ jsonrpc: "2.0", id: null, error: { code: 429, message: "Too many requests" } }, { status: 429 });

  const body = (await req.json().catch(() => null)) as { jsonrpc?: string; id?: unknown; method?: string; params?: unknown } | null;
  if (!body || Array.isArray(body) || typeof body.method !== "string")
    return json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid request" } }, { status: 400 });
  if (!ALLOWED.has(body.method))
    return json({ jsonrpc: "2.0", id: body.id ?? null, error: { code: -32601, message: `Method ${body.method} is not available` } }, { status: 403 });

  try {
    const res = await fetch(env.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: body.id ?? 1, method: body.method, params: body.params ?? [] }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    return new Response(text, { status: res.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  } catch {
    return json({ jsonrpc: "2.0", id: body.id ?? null, error: { code: -32000, message: "RPC unreachable" } }, { status: 502 });
  }
}
