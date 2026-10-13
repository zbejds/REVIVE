/**
 * The REVIVE mark ("Bloom pulse"): a flat heartbeat line that spikes and
 * blooms into a flower — the same idea as the hero artwork.
 */
const PETAL = "M32 24C28.2 18.6 28.6 11 32 6.5C35.4 11 35.8 18.6 32 24Z";

export function Mark({ className = "", animate = false }: { className?: string; animate?: boolean }) {
  // Same gradients everywhere, so shared ids are safe even if the mark appears twice.
  return (
    <svg viewBox="6 2 52 50" className={className} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="rv-line" x1="12" y1="54" x2="52" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7D62F0" />
          <stop offset=".55" stopColor="#C4B2FF" />
          <stop offset="1" stopColor="#FFB86B" />
        </linearGradient>
        <linearGradient id="rv-petal" x1="32" y1="26" x2="32" y2="4" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFC98A" />
          <stop offset=".45" stopColor="#D9CBFF" />
          <stop offset="1" stopColor="#9F86FF" />
        </linearGradient>
        <radialGradient id="rv-glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(32 20) scale(16)">
          <stop offset="0" stopColor="#FFB86B" stopOpacity=".55" />
          <stop offset=".5" stopColor="#B9A4FF" stopOpacity=".18" />
          <stop offset="1" stopColor="#B9A4FF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="20" r="16" fill="url(#rv-glow)" />
      <g fill="url(#rv-petal)">
        <path d={PETAL} transform="rotate(-52 32 24)" opacity=".75" />
        <path d={PETAL} transform="rotate(52 32 24)" opacity=".75" />
        <path d={PETAL} transform="rotate(-24 32 24)" opacity=".9" />
        <path d={PETAL} transform="rotate(24 32 24)" opacity=".9" />
        <path d={PETAL} />
      </g>
      <path
        d="M8 42h13l3.5-5 4.5 11 3-24 4 20 2.5-2H56"
        stroke="url(#rv-line)"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={animate ? 120 : undefined}
        className={animate ? "animate-trace" : undefined}
      />
    </svg>
  );
}

/** Kept for existing call sites (footer, 404). */
export function Pulse({ className = "" }: { className?: string }) {
  return <Mark className={className} />;
}

export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <Mark className="h-9 w-9" animate />
      <span className="font-display text-[18px] font-black tracking-[0.06em] text-bone">REVIVE</span>
    </span>
  );
}
