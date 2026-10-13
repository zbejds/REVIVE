# ENCORE

**The memes never die. Revive the legends.**

ENCORE is a Solana memecoin discovery, voting and trading app. Browse forgotten Solana legends, inspect real candlestick charts, vote with a free Phantom signature, and swap through Jupiter, all on one page per token.

Built with Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, TradingView Lightweight Charts v5, Solana wallet-adapter (Phantom), Jupiter Swap API v2 and PostgreSQL.

---

## What works out of the box

| Feature | Needs | Without it |
|---|---|---|
| Live prices, market cap, FDV, liquidity, volume, pools | nothing (DexScreener public API) | — |
| Candlestick charts (1m → 1d), volume, crosshair, history paging | nothing (GeckoTerminal public API) or `BIRDEYE_API_KEY` | — |
| Phantom connect, SOL + token balances | nothing (public RPC) or `SOLANA_RPC_URL` | — |
| Community voting + vote-ranked leaderboard | `DATABASE_URL` | Voting shows as **offline**; leaderboard falls back to archive order |
| Swaps | `JUPITER_API_KEY` | Trade panel shows **trading not configured** |

ENCORE never fills a missing service with invented numbers. Offline features say so in a banner and on `/rules#setup`.

## Quick start (local)

```bash
npm install
cp .env.example .env.local      # fill in what you have
npm run db:migrate              # only if DATABASE_URL is set
npm run dev                     # http://localhost:3000
```

Node 20.9+ is required.

## Deploy to Vercel (about 5 minutes)

1. Push this folder to a GitHub repo and import it at vercel.com/new.
2. Create a Postgres database (Vercel Postgres/Neon, Supabase, or any Postgres 14+). Copy its connection string.
3. Get a Jupiter API key at https://developers.jup.ag/portal.
4. Recommended: get an RPC URL from Helius, Triton or QuickNode. The public RPC is heavily rate limited.
5. In Vercel → Settings → Environment Variables add:
   - `DATABASE_URL`, `DATABASE_SSL=require`
   - `JUPITER_API_KEY`
   - `SOLANA_RPC_URL`
   - `VOTE_IP_SALT` (any long random string)
   - optional: `BIRDEYE_API_KEY`, `MIN_VOTER_SOL`, `JUPITER_REFERRAL_ACCOUNT` + `JUPITER_REFERRAL_FEE_BPS`
6. Run the migration once against that database from your machine:
   `DATABASE_URL="postgres://..." DATABASE_SSL=require npm run db:migrate`
7. Deploy. Visit `/rules#setup` to confirm every integration shows **On**.

Re-run `npm run db:migrate` whenever you edit `data/registry.json`.

## How it works

```
Browser ──► Next.js API routes (keys stay here) ──► DexScreener   (market data, pools)
   │                                           ├──► GeckoTerminal / Birdeye (OHLCV)
   │                                           ├──► Jupiter Swap v2 (/order, /execute)
   │                                           ├──► Solana RPC  (balances, simulate, confirm)
   │                                           └──► PostgreSQL  (votes, nonces, snapshots)
   └──► Phantom (signs messages + transactions; keys never leave the wallet)
```

### Token identity
`data/registry.json` is the single source of truth. Each token is keyed by its **mint address**. Only Solana tokens with `listed: true` and a valid base58 mint enter the market; duplicates are dropped. Market data is matched on `baseToken.address === mint`, so look-alike tickers can never feed a page. Non-Solana memes and migrated tokens appear in the archive's "vault" with the reason they aren't tradable.

To add a token: add an entry with its verified mint, then run `npm run db:migrate`.

### Charts
`/api/ohlcv/[mint]` charts the token's deepest pool (GeckoTerminal, priced in USD for *this* token even when it's the pool's quote side) or, with a Birdeye key, token-level OHLCV. The client polls for new candles (15 s at 1m → 5 min at 1d) and pages older history when you pan left. The footer shows the earliest candle available. No synthetic candles, ever.

### Voting
1. `POST /api/vote/challenge` → server stores a single-use, 5-minute nonce and returns the exact message.
2. Phantom signs the message (free, no transaction).
3. `POST /api/vote` → server verifies the ed25519 signature, the nonce, the wallet's 24 h cooldown per token, a 20-votes/day wallet cap, a per-network hourly cap (salted IP hash), and a minimum SOL balance. A Postgres advisory lock serializes votes per wallet so caps can't be raced.

Ranking uses vote counts only, never price.

### Trading
1. Typing an amount fetches a quote (`/order` without `taker`, no transaction built).
2. **Review** shows estimated output, minimum received, price impact (estimated against the SOL pool price), slippage, route, Jupiter fee, ENCORE fee and network fees.
3. **Confirm** fetches a fresh order with the wallet as `taker`, re-checks the price (asks you to review again if it moved more than 1 %), **simulates** the transaction, then asks Phantom to sign.
4. The signed transaction goes to Jupiter `/execute`. The UI polls `getSignatureStatuses` and shows success **only** once the cluster reports `confirmed`/`finalized`; on-chain failures and timeouts show explorer links instead.

Bonding-curve tokens (DexScreener `pumpfun` venue) are flagged and traded only if Jupiter returns a route.

## Project layout

```
data/registry.json        token registry (mints, eras, categories)
db/schema.sql             Postgres schema
scripts/migrate.mjs       applies schema + upserts registry
src/lib/                  server services: market, ohlcv, votes, rpc, cache, env
src/app/api/              tokens, ohlcv, vote, swap/order, swap/execute, rpc proxy, health
src/app/                  pages: / (leaderboard), /discover, /token/[mint], /rules
src/components/           UI: PriceChart, TradePanel, VoteButton, Leaderboard, ...
```

## Notes and limits

- Rate limiting and caching are per server instance (in-memory). At larger scale, move `src/lib/cache.ts` to Redis/Vercel KV.
- The RPC proxy allows only read, simulation and status methods; transactions are sent by Jupiter `/execute`.
- DexScreener doesn't expose unique trader counts, so ENCORE shows buy/sell counts instead.
- Launch platforms in the registry are set only where well documented; others display "Unverified".
- Memecoins are extremely risky. Nothing in this app is financial advice.

## Artwork & brand

- `public/art/` holds the abstract artwork generated with Higgsfield (hero, discover banner, aurora background, token-page sphere), compressed to WebP.
- `src/app/icon.svg` is the favicon (the ENCORE mark: a coin whose flatline breaks out as a pulse); `src/app/apple-icon.png` and `src/app/opengraph-image.jpg` are picked up automatically by Next.js.
- Swap any image by replacing the file with one of the same name.
