/**
 * The ENCORE mark: a replay arrow (one more time) circling a spotlight star.
 */
export function Mark({ className = "", animate = false }: { className?: string; animate?: boolean }) {
  // Same gradients everywhere, so shared ids are safe even if the mark appears twice.
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="en-arc" x1="8" y1="40" x2="40" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#D61F7C" />
          <stop offset=".5" stopColor="#FF4FA3" />
          <stop offset="1" stopColor="#FFE14D" />
        </linearGradient>
        <linearGradient id="en-star" x1="24" y1="15" x2="24" y2="33" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFF6B8" />
          <stop offset="1" stopColor="#FFE14D" />
        </linearGradient>
        <radialGradient id="en-glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(24 24) scale(12)">
          <stop offset="0" stopColor="#FFE14D" stopOpacity=".55" />
          <stop offset=".6" stopColor="#FF4FA3" stopOpacity=".15" />
          <stop offset="1" stopColor="#FF4FA3" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="12" fill="url(#en-glow)" />
      <g className={animate ? "origin-center animate-[spin-once_1.2s_ease-out_1]" : undefined} style={{ transformBox: "fill-box" }}>
        <path d="M39.5 24A15.5 15.5 0 1 1 32 10.6" stroke="url(#en-arc)" strokeWidth="3.6" strokeLinecap="round" />
        <path d="M31.4 5.2L35 12.3L27.1 12.9" stroke="url(#en-arc)" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <path
        d="M24 15.5C24.8 21.2 26.8 23.2 32.5 24C26.8 24.8 24.8 26.8 24 32.5C23.2 26.8 21.2 24.8 15.5 24C21.2 23.2 23.2 21.2 24 15.5Z"
        fill="url(#en-star)"
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
      <span className="font-display text-[18px] font-black tracking-[0.06em] text-bone">ENCORE</span>
    </span>
  );
}
