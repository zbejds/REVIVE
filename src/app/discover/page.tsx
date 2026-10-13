import type { Metadata } from "next";
import { DiscoverView } from "@/components/DiscoverView";
import { archivedTokens, categories, otherChainTokens } from "@/lib/registry";

export const metadata: Metadata = { title: "Discover forgotten Solana legends" };

export default function DiscoverPage() {
  return (
    <div className="mt-6">
      <div className="ring-grad relative overflow-hidden rounded-[32px] border border-white/[0.06]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/art/discs.webp" alt="" className="brand-tint absolute inset-0 h-full w-full object-cover opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/75 to-ink/10" />
        <div className="relative px-6 py-12 sm:px-10 sm:py-16">
          <p className="chip w-fit">The archive</p>
          <h1 className="mt-4 max-w-2xl text-balance font-display text-4xl font-black leading-[1.02] tracking-[-0.03em] sm:text-6xl">
            Discover forgotten <span className="grad-text">Solana legends</span>
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-bone-dim">
            A living museum of Solana meme culture, from the first dog coins of 2021 to the pump.fun era. Browse by era,
            launch platform or meme family. Every price, chart and age comes straight from on-chain market data.
          </p>
        </div>
      </div>
      <DiscoverView categories={categories} archived={archivedTokens} otherChains={otherChainTokens} />
    </div>
  );
}
