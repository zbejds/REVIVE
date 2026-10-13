import "server-only";
import { env } from "./env";

export async function rpc<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
  const res = await fetch(env.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`RPC ${method} failed with HTTP ${res.status}`);
  const j = (await res.json()) as { result?: T; error?: { message: string } };
  if (j.error) throw new Error(`RPC ${method}: ${j.error.message}`);
  return j.result as T;
}

export async function getSolBalance(wallet: string): Promise<number> {
  const r = await rpc<{ value: number }>("getBalance", [wallet, { commitment: "confirmed" }]);
  return r.value / 1e9;
}

const decimalsCache = new Map<string, number>();

export async function getMintDecimals(mint: string): Promise<number | null> {
  if (decimalsCache.has(mint)) return decimalsCache.get(mint)!;
  try {
    type R = { value: { data: { parsed?: { info?: { decimals?: number } } } } | null };
    const r = await rpc<R>("getAccountInfo", [mint, { encoding: "jsonParsed" }]);
    const d = r.value?.data?.parsed?.info?.decimals;
    if (typeof d === "number") {
      decimalsCache.set(mint, d);
      return d;
    }
  } catch (e) {
    console.warn("[rpc] decimals failed:", (e as Error).message);
  }
  return null;
}
