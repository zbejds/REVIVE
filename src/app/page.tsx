import Link from "next/link";
import { Leaderboard } from "@/components/Leaderboard";
import { listedTokens } from "@/lib/registry";

export default function Home() {
  return (
    <>
      <section className="ring-grad relative mt-6 overflow-hidden rounded-[32px] border border-white/[0.06] bg-black/40 lg:mt-8">
        {/* Hero artwork generated with Higgsfield: a chrome flatline that spikes and blooms. */}
        {/* It beats like a heart and sways slowly (see .hero-* in globals.css). */}
        <div className="hero-sway absolute inset-0" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/art/hero.webp"
            alt=""
            fetchPriority="high"
            className="hero-beat absolute inset-0 h-full w-full object-cover object-[54%_18%] opacity-95 sm:object-center"
          />
          <div className="hero-glow" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-ink/20 via-ink/65 to-ink/95 sm:bg-gradient-to-r sm:from-ink sm:via-ink/55 sm:to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink/90 to-transparent" />

        <div className="relative grid gap-10 px-6 py-12 sm:px-10 sm:py-16 lg:grid-cols-[1.25fr_1fr] lg:items-end lg:py-24">
          <div>
            <p className="chip w-fit">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-up" aria-hidden="true" /> Solana memecoin archive · live
            </p>
            <h1 className="mt-5 text-balance font-display text-[42px] font-black leading-[0.98] tracking-[-0.035em] sm:text-7xl">
              The memes
              <br />
              never die.
              <br />
              <span className="grad-text">Revive the legends.</span>
            </h1>
            <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-bone-dim">
              Pick the Solana coins you want back, sign a free vote with Phantom, and trade them right here when a real
              route exists.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/discover" className="btn-pulse px-6 py-3">
                Explore the archive
              </Link>
              <Link href="/rules" className="btn-ghost px-6 py-3">
                How voting works
              </Link>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-2 self-end lg:ml-auto lg:w-full lg:max-w-md">
            {[
              ["Legends", String(listedTokens.length), ""],
              ["Chain", "SOL", ""],
              ["Vote cost", "Free", "text-up"],
            ].map(([k, v, c]) => (
              <div key={k} className="rounded-2xl border border-white/10 bg-black/35 p-4 backdrop-blur-md">
                <dt className="label text-[10px]">{k}</dt>
                <dd className={`mt-1 font-display text-xl font-bold ${c}`}>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <Leaderboard />
    </>
  );
}
