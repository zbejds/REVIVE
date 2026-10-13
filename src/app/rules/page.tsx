import type { Metadata } from "next";
import { env, features, platformFeeBps } from "@/lib/env";
import { VOTE_RULES } from "@/lib/votes";

export const metadata: Metadata = { title: "Rules, fees & data sources" };
export const dynamic = "force-dynamic";

function H({ id, children }: { id: string; children: React.ReactNode }) {
  return <h2 id={id} className="scroll-mt-24 font-display text-xl font-bold">{children}</h2>;
}

export default function RulesPage() {
  return (
    <article className="mx-auto mt-8 max-w-3xl">
      <div className="flex items-center gap-6">
        <div className="min-w-0 flex-1">
          <p className="chip w-fit">Transparency</p>
          <h1 className="mt-3 text-balance font-display text-4xl font-black tracking-[-0.03em] sm:text-5xl">
            Rules, fees &amp; <span className="grad-text">data sources</span>
          </h1>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/art/sphere.webp" alt="" className="brand-tint hidden aspect-square h-40 w-auto rounded-[28px] object-cover sm:block" />
      </div>
      <p className="mt-3 text-[15px] leading-relaxed text-bone-dim">
        How ENCORE counts votes, what a trade costs, and where every number comes from.
      </p>

      <div className="mt-10 space-y-10 text-[15px] leading-relaxed text-bone-dim">
        <section className="space-y-3">
          <H id="voting">Voting rules</H>
          <p>A vote is a free message you sign in Phantom. It sends no transaction and grants no permissions. The server checks every vote before counting it:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>The signature must come from the wallet that requested the vote, using a single-use challenge that expires after {VOTE_RULES.nonceTtlMinutes} minutes.</li>
            <li>One vote per wallet per token every {VOTE_RULES.cooldownHours} hours.</li>
            <li>At most {VOTE_RULES.walletDailyCap} votes per wallet across all tokens in 24 hours.</li>
            <li>
              The wallet must hold at least <span className="num text-bone">{env.minVoterSol}</span> SOL
              {env.minVoterSol > 0 ? ", which makes mass-produced bot wallets expensive." : " (check currently disabled)."}
            </li>
            <li>At most {VOTE_RULES.ipHourlyCap} votes per network per hour. Network addresses are stored only as salted hashes.</li>
          </ul>
          <p>
            Rankings use vote counts only, inside the selected window (24 hours, 7 days or all time). Price, volume and market cap never affect rank. Ties go to the token that reached the count first.
          </p>
        </section>

        <section className="space-y-3">
          <H id="listing">What gets listed</H>
          <p>
            Every ENCORE token is identified by its Solana mint address, never by name or ticker. Copycat tokens with the same ticker don&apos;t resolve to a ENCORE page, and duplicates are rejected. Tokens from other chains appear only in the archive, labeled with their chain. Tokens that migrated to a new mint stay in the vault until the new mint is verified.
          </p>
        </section>

        <section className="space-y-3">
          <H id="fees">Trading &amp; fees</H>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Swaps are routed by Jupiter. Jupiter may charge a routing fee, shown in each quote before you confirm.</li>
            <li>
              ENCORE platform fee:{" "}
              <strong className="text-bone">{platformFeeBps ? `${(platformFeeBps / 100).toFixed(2)}% per swap` : "none"}</strong>.
            </li>
            <li>Solana network fees (base fee plus priority fee) are paid in SOL. Buying a token you&apos;ve never held can add a one-time refundable token account deposit.</li>
            <li>Each trade is simulated before Phantom asks you to sign. ENCORE shows a trade as successful only after the network confirms it.</li>
            <li>Tokens still on a pump.fun bonding curve can be traded only when Jupiter returns a valid route.</li>
          </ul>
          <p className="rounded-lg border border-line bg-panel p-3 text-sm">
            ENCORE never asks for your seed phrase or private key. Connecting your wallet only shares your public address; every trade and vote needs your separate approval in Phantom.
          </p>
        </section>

        <section className="space-y-3">
          <H id="data">Data sources</H>
          <ul className="list-disc space-y-1.5 pl-5">
            <li><strong className="text-bone">DexScreener</strong>: prices, market cap, FDV, liquidity, volume, trade counts, pools and pool creation dates.</li>
            <li><strong className="text-bone">{env.birdeyeApiKey ? "Birdeye" : "GeckoTerminal"}</strong>: historical OHLCV candles for charts. Charts start at the earliest candle the provider has; ENCORE never fills gaps with invented data.</li>
            <li><strong className="text-bone">Jupiter</strong>: quotes, routing and transaction landing.</li>
            <li><strong className="text-bone">Solana RPC</strong>: balances, simulations and confirmations.</li>
          </ul>
          <p>If a provider is unavailable, ENCORE shows the last saved snapshot with its timestamp and labels it as not live.</p>
        </section>

        <section className="space-y-3">
          <H id="risk">Risk</H>
          <p>Memecoins are extremely volatile, often illiquid, and can lose all their value. Votes measure community interest, not quality or safety. Nothing on ENCORE is financial advice.</p>
        </section>

        <section className="space-y-3">
          <H id="setup">Deployment status</H>
          <ul className="space-y-1.5">
            <Status ok label="Live market data & charts" detail="No key needed" />
            <Status ok={features.voting} label="Community voting" detail={features.voting ? "Database connected" : "Set DATABASE_URL and run npm run db:migrate"} />
            <Status ok={features.trading} label="Trading" detail={features.trading ? "Jupiter API key set" : "Set JUPITER_API_KEY (developers.jup.ag/portal)"} />
            <Status ok={features.customRpc} label="Dedicated RPC" detail={features.customRpc ? "Custom endpoint" : "Using the public RPC, which is rate limited. Set SOLANA_RPC_URL."} />
          </ul>
        </section>
      </div>
    </article>
  );
}

function Status({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <li className="flex items-start gap-3 rounded-lg border border-line bg-panel px-3 py-2.5 text-sm">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ok ? "bg-up" : "bg-warn"}`} aria-hidden="true" />
      <span>
        <span className="font-semibold text-bone">{label}</span> <span className="text-muted">· {ok ? "On" : "Off"}</span>
        <span className="block text-xs text-muted">{detail}</span>
      </span>
    </li>
  );
}
