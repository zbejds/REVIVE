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
