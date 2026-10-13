import "server-only";
import { createHash, randomBytes } from "node:crypto";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { db, withTx } from "./db";
import { env } from "./env";
import { getToken, isListedMint, listedTokens } from "./registry";
import { getSolBalance } from "./rpc";
import type { VoteStats, VoteWindow } from "./types";

/** Published voting rules — rendered on /rules and enforced below. */
export const VOTE_RULES = {
  cooldownHours: 24, // one vote per wallet per token per 24h
  walletDailyCap: 20, // max votes per wallet across all tokens per 24h
  ipHourlyCap: 30, // max votes per network address per hour
  nonceTtlMinutes: 5,
};

const WINDOW_SQL: Record<VoteWindow, string> = {
  "24h": "AND created_at > now() - interval '24 hours'",
  "7d": "AND created_at > now() - interval '7 days'",
  all: "",
};

/**
 * Mirror data/registry.json into the tokens table once per server instance, so
 * coins added or delisted in the registry need no manual database step.
 */
let registrySynced: Promise<void> | null = null;
export function syncRegistry(): Promise<void> {
  const pool = db();
  if (!pool) return Promise.resolve();
  if (!registrySynced) {
    registrySynced = pool
      .query(
        `INSERT INTO tokens (mint, symbol, name, chain, listed, launch_platform, era, legend_rank)
         SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::bool[], $6::text[], $7::text[], $8::int[])
         ON CONFLICT (mint) DO UPDATE SET symbol = EXCLUDED.symbol, name = EXCLUDED.name, listed = EXCLUDED.listed,
           launch_platform = EXCLUDED.launch_platform, era = EXCLUDED.era, legend_rank = EXCLUDED.legend_rank, updated_at = now()`,
        [
          listedTokens.map((t) => t.mint),
          listedTokens.map((t) => t.symbol),
          listedTokens.map((t) => t.name),
          listedTokens.map((t) => t.chain),
          listedTokens.map(() => true),
          listedTokens.map((t) => t.launchPlatform),
          listedTokens.map((t) => t.era),
          listedTokens.map((t) => t.legendRank),
        ],
      )
      .then(() =>
        pool.query(`UPDATE tokens SET listed = FALSE, updated_at = now() WHERE listed AND NOT (mint = ANY($1))`, [
          listedTokens.map((t) => t.mint),
        ]),
      )
      .then(() => undefined)
      .catch((e) => {
        registrySynced = null; // retry on the next request
        console.warn("[votes] registry sync failed:", (e as Error).message);
      });
  }
  return registrySynced ?? Promise.resolve();
}

/** Vote counts and ENCORE rank for every listed token. Ranking uses votes only. */
export async function getVoteTable(window: VoteWindow): Promise<Map<string, VoteStats> | null> {
  const pool = db();
  if (!pool) return null;
  await syncRegistry();
  const { rows } = await pool.query<{ mint: string; votes: string; last_vote: Date }>(
    `SELECT mint, count(*)::text AS votes, max(created_at) AS last_vote
       FROM votes WHERE mint = ANY($1) ${WINDOW_SQL[window]}
      GROUP BY mint`,
    [listedTokens.map((t) => t.mint)],
  );
  const counts = new Map(rows.map((r) => [r.mint, { votes: Number(r.votes), last: r.last_vote?.getTime() ?? 0 }]));
  // Ties: earlier-reached count wins (older last vote ranks higher), then legend rank.
  const ordered = [...listedTokens].sort((a, b) => {
    const va = counts.get(a.mint), vb = counts.get(b.mint);
    const d = (vb?.votes ?? 0) - (va?.votes ?? 0);
    if (d) return d;
    if (va && vb && va.last !== vb.last) return va.last - vb.last;
    return a.legendRank - b.legendRank;
  });
  const out = new Map<string, VoteStats>();
  ordered.forEach((t, i) => {
    const v = counts.get(t.mint)?.votes ?? 0;
    out.set(t.mint, { votes: v, rank: v > 0 ? i + 1 : null });
  });
  return out;
}

export async function getTokenCommunity(mint: string) {
  const pool = db();
  if (!pool) return null;
  const [recent, daily, totals] = await Promise.all([
    pool.query<{ wallet: string; created_at: Date }>(
      `SELECT wallet, created_at FROM votes WHERE mint = $1 ORDER BY created_at DESC LIMIT 12`,
      [mint],
    ),
    pool.query<{ day: string; votes: string }>(
      `SELECT to_char(d.day, 'YYYY-MM-DD') AS day, count(v.id)::text AS votes
         FROM generate_series((now() at time zone 'utc')::date - 13, (now() at time zone 'utc')::date, interval '1 day') AS d(day)
         LEFT JOIN votes v ON v.mint = $1 AND (v.created_at at time zone 'utc')::date = d.day
        GROUP BY d.day ORDER BY d.day`,
      [mint],
    ),
    pool.query<{ all_time: string; d1: string; d7: string; voters: string }>(
      `SELECT count(*)::text AS all_time,
              count(*) FILTER (WHERE created_at > now() - interval '24 hours')::text AS d1,
              count(*) FILTER (WHERE created_at > now() - interval '7 days')::text AS d7,
              count(DISTINCT wallet)::text AS voters
         FROM votes WHERE mint = $1`,
      [mint],
    ),
  ]);
  const t = totals.rows[0];
  return {
    recent: recent.rows.map((r) => ({ wallet: r.wallet, at: r.created_at.getTime() })),
    daily: daily.rows.map((r) => ({ day: r.day, votes: Number(r.votes) })),
    totals: { all: Number(t.all_time), d1: Number(t.d1), d7: Number(t.d7), voters: Number(t.voters) },
  };
}

export class VoteError extends Error {
  constructor(public status: number, message: string, public code: string) {
    super(message);
  }
}

const isPubkey = (s: string) => {
  try {
    return bs58.decode(s).length === 32;
  } catch {
    return false;
  }
};

export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`${env.voteIpSalt}:${ip}`).digest("hex").slice(0, 32);
}

export async function issueChallenge(wallet: string, mint: string) {
  const pool = db();
  if (!pool) throw new VoteError(503, "Voting is offline: the database is not configured.", "offline");
  if (!isPubkey(wallet)) throw new VoteError(400, "That is not a valid Solana wallet address.", "bad_wallet");
  const token = getToken(mint);
  if (!token || !isListedMint(mint)) throw new VoteError(404, "This token is not listed on ENCORE.", "not_listed");

  const nonce = bs58.encode(randomBytes(18));
  const issued = new Date();
  const expires = new Date(issued.getTime() + VOTE_RULES.nonceTtlMinutes * 60_000);
  const message = [
    "ENCORE community vote",
    "",
    `I am calling ${token.symbol} back for an encore.`,
    `Token mint: ${mint}`,
    `Wallet: ${wallet}`,
    `Nonce: ${nonce}`,
    `Issued: ${issued.toISOString()}`,
    "",
    "Signing this message is free. It does not send a transaction or grant any permission.",
  ].join("\n");

  // Coins added to data/registry.json after the database was set up get their
  // row created on first vote, so votes never fail on the foreign key.
  await pool.query(
    `INSERT INTO tokens (mint, symbol, name, chain, listed, launch_platform, era, categories, legend_rank)
     VALUES ($1,$2,$3,$4,TRUE,$5,$6,$7,$8) ON CONFLICT (mint) DO NOTHING`,
    [token.mint, token.symbol, token.name, token.chain, token.launchPlatform, token.era, token.categories, token.legendRank],
  );

  await pool.query(
    `INSERT INTO vote_nonces (nonce, wallet, mint, message, issued_at, expires_at) VALUES ($1,$2,$3,$4,$5,$6)`,
    [nonce, wallet, mint, message, issued, expires],
  );
  return { nonce, message, expiresAt: expires.getTime() };
}

/** Validate a signed challenge and record the vote. All checks are server-side. */
export async function castVote(input: { wallet: string; mint: string; nonce: string; signature: string; ip: string | null }) {
  if (!db()) throw new VoteError(503, "Voting is offline: the database is not configured.", "offline");
  const { wallet, mint, nonce, signature } = input;
  if (!isPubkey(wallet)) throw new VoteError(400, "Invalid wallet address.", "bad_wallet");
  if (!isListedMint(mint)) throw new VoteError(404, "This token is not listed on ENCORE.", "not_listed");
  const ipHash = hashIp(input.ip);

  // Anti-sybil balance check happens before the transaction (network call).
  if (env.minVoterSol > 0) {
    let bal: number;
    try {
      bal = await getSolBalance(wallet);
    } catch {
      throw new VoteError(503, "Couldn't check your wallet balance right now. Try again in a moment.", "rpc");
    }
    if (bal < env.minVoterSol) {
      throw new VoteError(403, `Voting wallets need at least ${env.minVoterSol} SOL. This keeps bot wallets out.`, "min_balance");
    }
  }

  return withTx(async (c) => {
    // Serialize concurrent votes from the same wallet so caps can't be raced.
    await c.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [wallet]);

    const { rows } = await c.query<{ wallet: string; mint: string; message: string; expires_at: Date; used_at: Date | null }>(
      `SELECT wallet, mint, message, expires_at, used_at FROM vote_nonces WHERE nonce = $1 FOR UPDATE`,
      [nonce],
    );
    const ch = rows[0];
    if (!ch || ch.wallet !== wallet || ch.mint !== mint)
      throw new VoteError(400, "This vote request doesn't match. Please vote again.", "bad_nonce");
    if (ch.used_at) throw new VoteError(409, "This vote was already submitted.", "nonce_used");
    if (ch.expires_at.getTime() < Date.now()) throw new VoteError(410, "The vote request expired. Please vote again.", "nonce_expired");

    let ok = false;
    try {
      ok = nacl.sign.detached.verify(new TextEncoder().encode(ch.message), bs58.decode(signature), bs58.decode(wallet));
    } catch {
      ok = false;
    }
    if (!ok) throw new VoteError(401, "The wallet signature didn't verify.", "bad_signature");

    await c.query(`UPDATE vote_nonces SET used_at = now() WHERE nonce = $1`, [nonce]);

    const cooldown = await c.query(
      `SELECT created_at FROM votes WHERE wallet = $1 AND mint = $2 AND created_at > now() - make_interval(hours => $3)
        ORDER BY created_at DESC LIMIT 1`,
      [wallet, mint, VOTE_RULES.cooldownHours],
    );
    if (cooldown.rowCount) {
      const next = new Date(cooldown.rows[0].created_at.getTime() + VOTE_RULES.cooldownHours * 3_600_000);
      throw new VoteError(429, `You already voted for this token. You can vote again after ${next.toUTCString()}.`, "cooldown");
    }

    const daily = await c.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM votes WHERE wallet = $1 AND created_at > now() - interval '24 hours'`,
      [wallet],
    );
    if (Number(daily.rows[0].n) >= VOTE_RULES.walletDailyCap)
      throw new VoteError(429, `Each wallet can cast ${VOTE_RULES.walletDailyCap} votes per 24 hours.`, "wallet_cap");

    if (ipHash) {
      const perIp = await c.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM votes WHERE ip_hash = $1 AND created_at > now() - interval '1 hour'`,
        [ipHash],
      );
      if (Number(perIp.rows[0].n) >= VOTE_RULES.ipHourlyCap)
        throw new VoteError(429, "Too many votes from your network in the last hour. Try again later.", "ip_cap");
    }

    await c.query(`INSERT INTO votes (mint, wallet, signature, ip_hash) VALUES ($1,$2,$3,$4)`, [mint, wallet, signature, ipHash]);
    return { ok: true };
  });
}
