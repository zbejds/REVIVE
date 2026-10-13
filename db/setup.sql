-- REVIVE one-step database setup.
-- Paste this whole file into your database's SQL editor (e.g. Neon → SQL Editor) and run it.
-- Safe to run again. Equivalent to `npm run db:migrate`. The app also syncs the registry itself.

-- REVIVE database schema (PostgreSQL 14+). Idempotent: safe to run repeatedly.

-- Registry mirror. data/registry.json is the source of truth; `npm run db:migrate`
-- upserts it here so votes reference a known mint.
CREATE TABLE IF NOT EXISTS tokens (
  mint             TEXT PRIMARY KEY CHECK (length(mint) BETWEEN 32 AND 44),
  symbol           TEXT NOT NULL,
  name             TEXT NOT NULL,
  chain            TEXT NOT NULL DEFAULT 'solana',
  listed           BOOLEAN NOT NULL DEFAULT TRUE,
  status           TEXT,
  launch_platform  TEXT,
  era              TEXT,
  categories       TEXT[] NOT NULL DEFAULT '{}',
  legend_rank      INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trading pairs seen for each token (from DexScreener), with the time we saw them.
CREATE TABLE IF NOT EXISTS pairs (
  pair_address     TEXT PRIMARY KEY,
  mint             TEXT NOT NULL REFERENCES tokens(mint) ON DELETE CASCADE,
  dex_id           TEXT NOT NULL,
  quote_mint       TEXT,
  quote_symbol     TEXT,
  liquidity_usd    NUMERIC,
  pair_created_at  TIMESTAMPTZ,
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pairs_mint_idx ON pairs (mint);

-- Last known market snapshot per token. Used as a labeled, timestamped fallback
-- when a provider is rate limited. Never presented as live.
CREATE TABLE IF NOT EXISTS market_snapshots (
  mint             TEXT PRIMARY KEY REFERENCES tokens(mint) ON DELETE CASCADE,
  payload          JSONB NOT NULL,
  source           TEXT NOT NULL,
  fetched_at       TIMESTAMPTZ NOT NULL
);

-- Single-use challenges a wallet must sign to vote.
CREATE TABLE IF NOT EXISTS vote_nonces (
  nonce            TEXT PRIMARY KEY,
  wallet           TEXT NOT NULL,
  mint             TEXT NOT NULL REFERENCES tokens(mint) ON DELETE CASCADE,
  message          TEXT NOT NULL,
  issued_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ NOT NULL,
  used_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS vote_nonces_expires_idx ON vote_nonces (expires_at);

-- One row per accepted vote.
CREATE TABLE IF NOT EXISTS votes (
  id               BIGSERIAL PRIMARY KEY,
  mint             TEXT NOT NULL REFERENCES tokens(mint) ON DELETE CASCADE,
  wallet           TEXT NOT NULL,
  signature        TEXT NOT NULL UNIQUE,
  ip_hash          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS votes_mint_time_idx ON votes (mint, created_at DESC);
CREATE INDEX IF NOT EXISTS votes_wallet_time_idx ON votes (wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS votes_ip_time_idx ON votes (ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS votes_time_idx ON votes (created_at DESC);


INSERT INTO tokens (mint, symbol, name, chain, listed, status, launch_platform, era, categories, legend_rank) VALUES
  ('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU','SAMO','Samoyedcoin','solana',TRUE,NULL,'Serum / Raydium','2021 · First wave',ARRAY['early','dog','favorites','underdogs']::text[],6),
  ('EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm','WIF','dogwifhat','solana',TRUE,NULL,'Raydium','Late 2023 · Hat season',ARRAY['dog','raydium','viral']::text[],2),
  ('HhJpBhRRn4g56VsyLuT8DL5Bv31HkXqsrahTTUCZeZg4','MYRO','Myro','solana',TRUE,NULL,'Raydium','Late 2023 · Hat season',ARRAY['dog','raydium','favorites','underdogs']::text[],8),
  ('7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr','POPCAT','POPCAT','solana',TRUE,NULL,'Raydium','Dec 2023 · Cat rotation',ARRAY['cat','raydium','viral']::text[],3),
  ('ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82','BOME','BOOK OF MEME','solana',TRUE,NULL,'Raydium','Mar 2024 · Presale mania',ARRAY['ai','raydium','viral']::text[],5),
  ('MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5','MEW','cat in a dogs world','solana',TRUE,NULL,'Raydium','Mar 2024 · Presale mania',ARRAY['cat','raydium']::text[],4),
  ('5mbK36SZ7J19An8jFochhQS4of8g6BwUjbeCSxBSoWdp','MICHI','michi','solana',TRUE,NULL,NULL,'Spring 2024 · Cat rotation',ARRAY['cat','favorites','underdogs']::text[],10),
  ('63LfDmNb3MQ8mw9MtZ2To9bEA2M71kZUUGq5tiJxcqj9','GIGA','GIGACHAD','solana',TRUE,NULL,NULL,'2024 · Grind era',ARRAY['ai','favorites']::text[],9),
  ('A8C3xuqscfmyLrte3VmTqrAq8kgMASius9AFNANwpump','FWOG','FWOG','solana',TRUE,NULL,'pump.fun','Summer 2024 · pump.fun summer',ARRAY['pumpfun','underdogs']::text[],13),
  ('ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY','MOODENG','Moo Deng','solana',TRUE,NULL,NULL,'Sep 2024 · Animal news',ARRAY['viral','ai']::text[],11),
  ('CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump','GOAT','Goatseus Maximus','solana',TRUE,NULL,'pump.fun','Oct 2024 · AI agents',ARRAY['pumpfun','ai','viral']::text[],7),
  ('9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump','Fartcoin','Fartcoin','solana',TRUE,NULL,'pump.fun','Oct 2024 · AI agents',ARRAY['pumpfun','ai']::text[],12),
  ('2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump','PNUT','Peanut the Squirrel','solana',TRUE,NULL,'pump.fun','Nov 2024 · Animal news',ARRAY['pumpfun','viral','ai']::text[],14),
  ('Df6yfrKC8kZE3KNkrHERKzAetSxbrWeniQfyJY4Jpump','CHILLGUY','Just a chill guy','solana',TRUE,NULL,'pump.fun','Nov 2024 · Internet culture',ARRAY['pumpfun','viral','favorites','dog']::text[],15),
  ('5z3EqYQo9HiCEs3R84RCDMu2n7anpDMxRhdK8PSWmrRC','PONKE','PONKE','solana',TRUE,NULL,'Raydium','Dec 2023 · Hat season',ARRAY['raydium','favorites','underdogs']::text[],17),
  ('WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p3LCpk','WEN','Wen','solana',TRUE,NULL,'Community airdrop','Jan 2024 · Airdrop season',ARRAY['cat','favorites']::text[],18),
  ('7EYnhQoR9YM3N7UoaKRoA44Uy8JeaZV3qyouov87awMs','SILLY','Silly Dragon','solana',TRUE,NULL,'Raydium','Dec 2023 · Hat season',ARRAY['raydium','underdogs','favorites']::text[],19),
  ('5LafQUrVco6o7KMz42eqVEJ9LW31StPyGjeeu5sKoMtA','MUMU','Mumu the Bull','solana',TRUE,NULL,'Raydium','Mar 2024 · Presale mania',ARRAY['raydium','underdogs']::text[],20),
  ('6D7NaB2xsLd7cauWu1wKk6KBsJohJmP2qZH9GEfVi5Ui','SC','Shark Cat','solana',TRUE,NULL,'Raydium','Mar 2024 · Cat rotation',ARRAY['cat','raydium','viral']::text[],21),
  ('3S8qX1MsMqRbiwKg2cQyx7nis1oHMgaCuc9c4VfvVdPN','MOTHER','MOTHER IGGY','solana',TRUE,NULL,'Raydium','May 2024 · Celebrity coins',ARRAY['viral','raydium']::text[],22),
  ('8x5VqbHA8D7NkD52uNuS5nnt3PwA8pLD34ymskeSo2Wn','ZEREBRO','zerebro','solana',TRUE,NULL,'Raydium','Oct 2024 · AI agents',ARRAY['ai','viral']::text[],23),
  ('Dz9mQ9NzkBcCsuGPFJ3r1bS4wgqKMHBPiVuniW8Mbonk','USELESS','USELESS COIN','solana',TRUE,NULL,'bonk.fun','May 2025 · Launchpad wars',ARRAY['viral','favorites']::text[],24),
  ('7BgBvyjrZX1YKz4oh9mjb8ZScatkkwb8DzFx7LoiVkM3','SLERF','SLERF (pre-migration mint)','solana',FALSE,'migrated','Raydium','Mar 2024 · Presale mania',ARRAY['viral','favorites']::text[],16)
ON CONFLICT (mint) DO UPDATE SET symbol = EXCLUDED.symbol, name = EXCLUDED.name, chain = EXCLUDED.chain,
  listed = EXCLUDED.listed, status = EXCLUDED.status, launch_platform = EXCLUDED.launch_platform,
  era = EXCLUDED.era, categories = EXCLUDED.categories, legend_rank = EXCLUDED.legend_rank, updated_at = now();

-- Delist anything no longer in the registry (e.g. BONK).
UPDATE tokens SET listed = FALSE WHERE mint NOT IN ('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU','EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm','HhJpBhRRn4g56VsyLuT8DL5Bv31HkXqsrahTTUCZeZg4','7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr','ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82','MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5','5mbK36SZ7J19An8jFochhQS4of8g6BwUjbeCSxBSoWdp','63LfDmNb3MQ8mw9MtZ2To9bEA2M71kZUUGq5tiJxcqj9','A8C3xuqscfmyLrte3VmTqrAq8kgMASius9AFNANwpump','ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY','CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump','9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump','2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump','Df6yfrKC8kZE3KNkrHERKzAetSxbrWeniQfyJY4Jpump','5z3EqYQo9HiCEs3R84RCDMu2n7anpDMxRhdK8PSWmrRC','WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p3LCpk','7EYnhQoR9YM3N7UoaKRoA44Uy8JeaZV3qyouov87awMs','5LafQUrVco6o7KMz42eqVEJ9LW31StPyGjeeu5sKoMtA','6D7NaB2xsLd7cauWu1wKk6KBsJohJmP2qZH9GEfVi5Ui','3S8qX1MsMqRbiwKg2cQyx7nis1oHMgaCuc9c4VfvVdPN','8x5VqbHA8D7NkD52uNuS5nnt3PwA8pLD34ymskeSo2Wn','Dz9mQ9NzkBcCsuGPFJ3r1bS4wgqKMHBPiVuniW8Mbonk');
