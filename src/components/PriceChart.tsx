"use client";

import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useCallback, useEffect, useRef, useState } from "react";
import { getJson } from "@/lib/client";
import { fmtDate, fmtNum, fmtPrice } from "@/lib/format";
import type { Candle, OhlcvResponse, Timeframe } from "@/lib/types";

const TFS: Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "1d"];
const POLL_MS: Record<Timeframe, number> = { "1m": 15_000, "5m": 20_000, "15m": 30_000, "1h": 60_000, "4h": 120_000, "1d": 300_000 };
const UP = "#4FD1A5";
const DOWN = "#F2667A";

type Mode = "candles" | "line";

export function PriceChart({ mint, symbol, compact = false }: { mint: string; symbol: string; compact?: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const dataRef = useRef<Candle[]>([]);
  const hasMoreRef = useRef(false);
  const loadingOlderRef = useRef(false);
  const tfRef = useRef<Timeframe>("15m");

  const [tf, setTf] = useState<Timeframe>("15m");
  const [mode, setMode] = useState<Mode>("candles");
  const [meta, setMeta] = useState<Pick<OhlcvResponse, "source" | "pool" | "earliest" | "hasMore" | "fetchedAt" | "note"> | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [errMsg, setErrMsg] = useState("");
  const [legend, setLegend] = useState<Candle | null>(null);

  tfRef.current = tf;

  // --- create chart once ---
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8B8898",
        fontFamily: "var(--font-mono), ui-monospace, monospace",
        fontSize: 11,
        attributionLogo: true,
      },
      grid: { vertLines: { color: "rgba(42,45,58,.55)" }, horzLines: { color: "rgba(42,45,58,.55)" } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(255,79,163,.5)", labelBackgroundColor: "#D61F7C" },
        horzLine: { color: "rgba(255,79,163,.5)", labelBackgroundColor: "#D61F7C" },
      },
      rightPriceScale: { borderColor: "#2A2D3A", scaleMargins: { top: 0.08, bottom: 0.26 } },
      timeScale: { borderColor: "#2A2D3A", timeVisible: true, secondsVisible: false, rightOffset: 6 },
      localization: { priceFormatter: (p: number) => fmtPrice(p, { dollar: false }) },
    });
    const priceFormat = { type: "custom" as const, formatter: (p: number) => fmtPrice(p, { dollar: false }), minMove: 1e-12 };
    candleRef.current = chart.addSeries(CandlestickSeries, {
      upColor: UP, downColor: DOWN, borderUpColor: UP, borderDownColor: DOWN, wickUpColor: UP, wickDownColor: DOWN, priceFormat,
    });
    lineRef.current = chart.addSeries(LineSeries, { color: "#FF4FA3", lineWidth: 2, priceFormat, visible: false });
    volRef.current = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "vol", lastValueVisible: false, priceLineVisible: false });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    chart.subscribeCrosshairMove((param) => {
      if (!param.time) return setLegend(null);
      const t = param.time as number;
      setLegend(dataRef.current.find((c) => c.time === t) ?? null);
    });

    chartRef.current = chart;
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  const paint = useCallback((candles: Candle[], fit: boolean) => {
    dataRef.current = candles;
    candleRef.current?.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close })));
    lineRef.current?.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close })));
    volRef.current?.setData(
      candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.volume, color: c.close >= c.open ? "rgba(79,209,165,.35)" : "rgba(242,102,122,.35)" })),
    );
    if (fit) chartRef.current?.timeScale().fitContent();
  }, []);

  // --- load on timeframe change ---
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setLegend(null);
    getJson<OhlcvResponse>(`/api/ohlcv/${mint}?tf=${tf}&limit=500`)
      .then((d) => {
        if (cancelled) return;
        hasMoreRef.current = d.hasMore;
        setMeta({ source: d.source, pool: d.pool, earliest: d.earliest, hasMore: d.hasMore, fetchedAt: d.fetchedAt, note: d.note });
        paint(d.candles, true);
        setStatus(d.candles.length ? "ready" : "empty");
        if (!d.candles.length) setErrMsg(d.note ?? "No candles are available for this timeframe yet.");
      })
      .catch((e: Error) => {
        if (cancelled) return;
        paint([], false);
        setStatus("error");
        setErrMsg(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [mint, tf, paint]);

  // --- near-real-time updates: merge the newest candles ---
  useEffect(() => {
    const id = setInterval(async () => {
      if (document.visibilityState !== "visible" || !dataRef.current.length) return;
      try {
        const d = await getJson<OhlcvResponse>(`/api/ohlcv/${mint}?tf=${tfRef.current}&limit=50`);
        if (d.timeframe !== tfRef.current) return;
        const last = dataRef.current[dataRef.current.length - 1].time;
        const fresh = d.candles.filter((c) => c.time >= last);
        if (!fresh.length) return;
        const merged = [...dataRef.current.filter((c) => c.time < fresh[0].time), ...fresh];
        dataRef.current = merged;
        for (const c of fresh) {
          const t = c.time as UTCTimestamp;
          candleRef.current?.update({ time: t, open: c.open, high: c.high, low: c.low, close: c.close });
          lineRef.current?.update({ time: t, value: c.close });
          volRef.current?.update({ time: t, value: c.volume, color: c.close >= c.open ? "rgba(79,209,165,.35)" : "rgba(242,102,122,.35)" });
        }
        setMeta((m) => (m ? { ...m, fetchedAt: d.fetchedAt, note: d.note } : m));
      } catch {
        /* keep the last good chart; the next tick retries */
      }
    }, POLL_MS[tf]);
    return () => clearInterval(id);
  }, [mint, tf]);

  // --- load older history when the user pans to the left edge ---
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const onRange = async (range: { from: number; to: number } | null) => {
      if (!range || range.from > 8 || !hasMoreRef.current || loadingOlderRef.current || !dataRef.current.length) return;
      loadingOlderRef.current = true;
      const tfAtStart = tfRef.current;
      try {
        const first = dataRef.current[0].time;
        const d = await getJson<OhlcvResponse>(`/api/ohlcv/${mint}?tf=${tfAtStart}&limit=500&before=${first}`);
        if (tfAtStart !== tfRef.current) return;
        const older = d.candles.filter((c) => c.time < first);
        hasMoreRef.current = d.hasMore && older.length > 0;
        if (older.length) {
          paint([...older, ...dataRef.current], false);
          setMeta((m) => (m ? { ...m, earliest: older[0].time, hasMore: hasMoreRef.current } : m));
        } else {
          setMeta((m) => (m ? { ...m, hasMore: false } : m));
        }
      } catch {
        /* ignore; user can pan again */
      } finally {
        loadingOlderRef.current = false;
      }
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);
    return () => chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange);
  }, [mint, paint]);

  // --- candle/line toggle ---
  useEffect(() => {
    candleRef.current?.applyOptions({ visible: mode === "candles" });
    lineRef.current?.applyOptions({ visible: mode === "line" });
  }, [mode]);

  const last = dataRef.current[dataRef.current.length - 1];
  const shown = legend ?? last ?? null;

  return (
    <div className="panel flex flex-col overflow-hidden">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <div role="tablist" aria-label="Timeframe" className="flex rounded-md bg-ink-2 p-0.5">
          {TFS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tf === t}
              onClick={() => setTf(t)}
              className={`num rounded px-2.5 py-1 text-xs transition ${tf === t ? "bg-panel-3 text-bone" : "text-muted hover:text-bone"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex rounded-md bg-ink-2 p-0.5" role="group" aria-label="Chart type">
          {(["candles", "line"] as Mode[]).map((m) => (
            <button
              key={m}
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`rounded px-2.5 py-1 text-xs capitalize transition ${mode === m ? "bg-panel-3 text-bone" : "text-muted hover:text-bone"}`}
            >
              {m}
            </button>
          ))}
        </div>
        <button className="rounded px-2 py-1 text-xs text-muted hover:text-bone" onClick={() => chartRef.current?.timeScale().fitContent()}>
          Fit
        </button>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-muted">
          <span className={`h-1.5 w-1.5 rounded-full ${status === "ready" ? "bg-up" : "bg-muted"}`} aria-hidden="true" />
          {meta ? `${meta.source === "birdeye" ? "Birdeye" : "GeckoTerminal"} · UTC · ${symbol}/USD` : "Loading…"}
        </span>
      </div>

      {/* OHLCV legend */}
      <div className="num flex flex-wrap gap-x-3 gap-y-0.5 px-3 pt-2 text-[11px] text-bone-dim">
        {shown ? (
          <>
            <span className="text-muted">{new Date(shown.time * 1000).toISOString().slice(0, 16).replace("T", " ")}</span>
            <span>O <b className="font-medium text-bone">{fmtPrice(shown.open, { dollar: false })}</b></span>
            <span>H <b className="font-medium text-bone">{fmtPrice(shown.high, { dollar: false })}</b></span>
            <span>L <b className="font-medium text-bone">{fmtPrice(shown.low, { dollar: false })}</b></span>
            <span>C <b className={`font-medium ${shown.close >= shown.open ? "text-up" : "text-down"}`}>{fmtPrice(shown.close, { dollar: false })}</b></span>
            <span>Vol <b className="font-medium text-bone">${fmtNum(shown.volume)}</b></span>
          </>
        ) : (
          <span className="text-muted">Hover the chart to inspect candles. Drag to pan, scroll to zoom.</span>
        )}
      </div>

      <div className={`relative ${compact ? "h-[320px]" : "h-[340px] sm:h-[460px] lg:h-[520px]"}`}>
        <div ref={boxRef} className="absolute inset-0" />
        {status !== "ready" && (
          <div className="absolute inset-0 grid place-items-center bg-panel/70 p-6 text-center">
            {status === "loading" ? (
              <span className="label animate-pulse">Loading real candles…</span>
            ) : (
              <span className="max-w-sm text-sm text-bone-dim">
                {status === "error" ? "Chart data is unavailable right now. " : ""}
                {errMsg}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-3 py-2 text-[11px] text-muted">
        {meta?.earliest ? (
          <span>
            Earliest candle loaded: <span className="num text-bone-dim">{fmtDate(meta.earliest * 1000)}</span>
            {meta.hasMore ? " · pan left for older history" : " · no older history available at this timeframe"}
          </span>
        ) : null}
        {meta?.pool && (
          <a className="hover:text-bone" href={`https://solscan.io/account/${meta.pool}`} target="_blank" rel="noreferrer">
            Charted pool <span className="num">{meta.pool.slice(0, 4)}…{meta.pool.slice(-4)}</span> ↗
          </a>
        )}
        {meta?.note && <span className="text-warn">{meta.note}</span>}
      </div>
    </div>
  );
}
