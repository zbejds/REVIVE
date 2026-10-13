import "server-only";
import { NextResponse } from "next/server";
import { ProviderError, RateLimitedError } from "./cache";

export function json(data: unknown, init: { status?: number; maxAge?: number } = {}) {
  return NextResponse.json(data, {
    status: init.status ?? 200,
    headers: {
      "cache-control": init.maxAge ? `public, s-maxage=${init.maxAge}, stale-while-revalidate=${init.maxAge * 4}` : "no-store",
    },
  });
}

export function errorJson(e: unknown) {
  if (e instanceof RateLimitedError) return json({ error: e.message, code: "rate_limited" }, { status: 429 });
  if (e instanceof ProviderError) return json({ error: `${e.provider} is unavailable right now.`, code: "provider" }, { status: 502 });
  console.error(e);
  return json({ error: "Something went wrong on our side.", code: "internal" }, { status: 500 });
}

export function clientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

/** Simple per-instance limiter for public API routes. */
const hits = new Map<string, { n: number; reset: number }>();
export function allow(key: string, perMinute: number): boolean {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) {
    hits.set(key, { n: 1, reset: now + 60_000 });
    if (hits.size > 10_000) hits.clear();
    return true;
  }
  h.n++;
  return h.n <= perMinute;
}
