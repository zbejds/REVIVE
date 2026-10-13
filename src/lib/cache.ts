import "server-only";

/**
 * Small in-process TTL cache with request coalescing and stale-on-error.
 * On serverless hosts each instance has its own cache; that is fine for
 * respecting provider limits at ENCORE's scale. Swap for Redis/KV when needed.
 */
interface Entry<T> {
  value: T;
  expires: number;
  storedAt: number;
}

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();
const MAX_ENTRIES = 2000;

export async function cached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
  opts: { staleMs?: number } = {},
): Promise<{ value: T; stale: boolean; storedAt: number }> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expires > now) return { value: hit.value, stale: false, storedAt: hit.storedAt };

  let p = inflight.get(key) as Promise<T> | undefined;
  if (!p) {
    p = load().finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  try {
    const value = await p;
    if (store.size > MAX_ENTRIES) {
      const first = store.keys().next().value;
      if (first !== undefined) store.delete(first);
    }
    store.set(key, { value, expires: Date.now() + ttlMs, storedAt: Date.now() });
    return { value, stale: false, storedAt: Date.now() };
  } catch (err) {
    const staleMs = opts.staleMs ?? 10 * 60_000;
    if (hit && now - hit.storedAt < staleMs) return { value: hit.value, stale: true, storedAt: hit.storedAt };
    throw err;
  }
}

/** Token bucket per provider, so ENCORE stays under documented rate limits. */
class Bucket {
  private tokens: number;
  private last = Date.now();
  constructor(private capacity: number, private perMinute: number) {
    this.tokens = capacity;
  }
  take(): boolean {
    const now = Date.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) / 60_000) * this.perMinute);
    this.last = now;
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }
}

export const limits = {
  // DexScreener documents 300 req/min for pair/token endpoints; stay well under.
  dexscreener: new Bucket(30, 200),
  // GeckoTerminal public API allows roughly 30 calls/min.
  geckoterminal: new Bucket(25, 25),
  birdeye: new Bucket(10, 60),
  jupiter: new Bucket(20, 50),
};

export class RateLimitedError extends Error {
  constructor(public provider: string) {
    super(`${provider} rate limit reached. Try again in a moment.`);
  }
}

export class ProviderError extends Error {
  constructor(public provider: string, public status: number, message: string) {
    super(message);
  }
}

export async function fetchJson<T>(
  provider: keyof typeof limits,
  url: string,
  init: RequestInit = {},
  timeoutMs = 10_000,
): Promise<T> {
  if (!limits[provider].take()) throw new RateLimitedError(provider);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { accept: "application/json", ...(init.headers || {}) },
      cache: "no-store",
    });
    if (res.status === 429) throw new RateLimitedError(provider);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new ProviderError(provider, res.status, `${provider} responded ${res.status}: ${body.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new ProviderError(provider, 504, `${provider} timed out`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
