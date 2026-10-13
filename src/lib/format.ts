const SUB = "₀₁₂₃₄₅₆₇₈₉";

/**
 * Memecoin-friendly USD price. Tiny prices use the trader's subscript-zero
 * notation: 0.00001234 → $0.0₄1234.
 */
export function fmtPrice(v: number | null | undefined, opts: { dollar?: boolean } = {}): string {
  const d = opts.dollar === false ? "" : "$";
  if (v == null || !Number.isFinite(v)) return "—";
  if (v === 0) return `${d}0`;
  if (v >= 1000) return d + v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (v >= 1) return d + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  if (v >= 0.001) return d + v.toPrecision(4).replace(/0+$/, "").replace(/\.$/, "");
  const s = v.toFixed(20);
  const m = s.match(/^0\.(0+)(\d{4})/);
  if (!m) return d + v.toExponential(3);
  const zeros = m[1].length;
  const sub = String(zeros).split("").map((c) => SUB[Number(c)]).join("");
  return `${d}0.0${sub}${m[2].replace(/0+$/, "") || "0"}`;
}

export function fmtUsd(v: number | null | undefined, compact = true): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (!compact) return "$" + v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

export function fmtNum(v: number | null | undefined, maxFrac = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `${(v / 1e3).toFixed(1)}K`;
  return v.toLocaleString("en-US", { maximumFractionDigits: maxFrac });
}

export function fmtPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(Math.abs(v) >= 100 ? 0 : 2)}%`;
}

export function shortAddr(a: string, n = 4): string {
  return a.length > n * 2 + 1 ? `${a.slice(0, n)}…${a.slice(-n)}` : a;
}

export function fmtAge(ms: number | null | undefined): string {
  if (!ms) return "—";
  const days = (Date.now() - ms) / 86_400_000;
  if (days < 1) return `${Math.max(1, Math.round(days * 24))}h`;
  if (days < 60) return `${Math.round(days)}d`;
  if (days < 730) return `${Math.round(days / 30.4)}mo`;
  return `${(days / 365.25).toFixed(1)}y`;
}

export function fmtAgo(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function fmtDate(ms: number | null | undefined): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export const changeClass = (v: number | null | undefined) =>
  v == null ? "text-muted" : v > 0 ? "text-up" : v < 0 ? "text-down" : "text-bone-dim";
