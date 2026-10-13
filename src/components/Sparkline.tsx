"use client";

import { useEffect, useRef, useState } from "react";
import type { OhlcvResponse } from "@/lib/types";

/** Lazy 48h hourly-close sparkline. Real candles only; shows "No chart data" otherwise. */
export function Sparkline({ mint, width = 120, height = 36 }: { mint: string; width?: number; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [closes, setCloses] = useState<number[] | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "empty" | "error" | "ok">("idle");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        setState("loading");
        fetch(`/api/ohlcv/${mint}?tf=1h&limit=48`)
          .then((r) => (r.ok ? (r.json() as Promise<OhlcvResponse>) : Promise.reject(r.status)))
          .then((d) => {
            if (cancelled) return;
            const c = d.candles.map((x) => x.close);
            setCloses(c);
            setState(c.length > 1 ? "ok" : "empty");
          })
          .catch(() => !cancelled && setState("error"));
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [mint]);

  let body: React.ReactNode = <div className="h-full w-full animate-pulse rounded bg-panel-2/60" />;
  if (state === "ok" && closes) {
    const min = Math.min(...closes), max = Math.max(...closes);
    const span = max - min || max || 1;
    const pts = closes.map((v, i) => [(i / (closes.length - 1)) * (width - 4) + 2, height - 3 - ((v - min) / span) * (height - 6)]);
    const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
    const up = closes[closes.length - 1] >= closes[0];
    const color = up ? "#4FD1A5" : "#F2667A";
    const [lx, ly] = pts[pts.length - 1];
    body = (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`48 hour price trend, ${up ? "up" : "down"}`}>
        <path d={`${d}L${lx},${height}L2,${height}Z`} fill={color} opacity="0.1" />
        <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx={lx} cy={ly} r="2.2" fill={color} />
      </svg>
    );
  } else if (state === "empty" || state === "error") {
    body = <span className="label text-[10px] normal-case tracking-normal">{state === "empty" ? "No chart data" : "Chart unavailable"}</span>;
  }

  return (
    <div ref={ref} style={{ width, height }} className="grid shrink-0 place-items-center">
      {body}
    </div>
  );
}
