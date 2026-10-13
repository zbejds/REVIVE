"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((body as { error?: string }).error || `Request failed (${res.status})`) as Error & { code?: string; status?: number };
    err.code = (body as { code?: string }).code;
    err.status = res.status;
    throw err;
  }
  return body as T;
}

/** Poll a JSON endpoint while the tab is visible. Keeps the last good data on errors. */
export function usePoll<T>(url: string | null, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const urlRef = useRef(url);
  urlRef.current = url;

  const load = useCallback(async () => {
    const u = urlRef.current;
    if (!u) return;
    try {
      const d = await getJson<T>(u);
      if (urlRef.current === u) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (urlRef.current === u) setError((e as Error).message);
    } finally {
      if (urlRef.current === u) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!url) return;
    setLoading(true);
    void load();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, intervalMs);
    const onVis = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [url, intervalMs, load]);

  return { data, error, loading, reload: load };
}

/** Minimal JSON-RPC call through ENCORE's server proxy. */
export async function rpcCall<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch("/api/rpc", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = (await res.json()) as { result?: T; error?: { message: string } };
  if (j.error) throw new Error(j.error.message);
  return j.result as T;
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
