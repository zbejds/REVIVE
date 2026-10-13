import type { Config } from "tailwindcss";

// REVIVE palette: a dim archive (ink + bone) where the pulse (lilac) and
// the candle (ember) are the only saturated colors. Up/down stay semantic.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#0D0E13", 2: "#12131A" },
        panel: { DEFAULT: "#16171F", 2: "#1D1F29", 3: "#252835" },
        line: { DEFAULT: "#2A2D3A", strong: "#3A3E50" },
        bone: { DEFAULT: "#ECE5D6", dim: "#B9B3A6" },
        muted: "#8B8898",
        pulse: { DEFAULT: "#FF4FA3", deep: "#D61F7C", ink: "#2B0718" },
        ember: { DEFAULT: "#FFE14D", deep: "#F2B705" },
        up: "#4FD1A5",
        down: "#F2667A",
        warn: "#F5C451",
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,79,163,.35), 0 8px 30px -8px rgba(255,79,163,.45)",
      },
      keyframes: {
        beat: {
          "0%,100%": { transform: "scale(1)" },
          "30%": { transform: "scale(1.18)" },
          "45%": { transform: "scale(.96)" },
        },
        "spin-once": {
          from: { transform: "rotate(-180deg)", opacity: "0" },
          to: { transform: "rotate(0deg)", opacity: "1" },
        },
        trace: {
          from: { strokeDashoffset: "240" },
          to: { strokeDashoffset: "0" },
        },
      },
      animation: {
        beat: "beat .6s ease-out",
        trace: "trace 2.4s ease-out forwards",
      },
    },
  },
  plugins: [],
};

export default config;
