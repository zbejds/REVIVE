import "server-only";

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && v !== undefined && v !== "" ? n : fallback;
};

export const env = {
  databaseUrl: process.env.DATABASE_URL || "",
  databaseSsl: process.env.DATABASE_SSL === "require",
  rpcUrl: process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  jupiterApiKey: process.env.JUPITER_API_KEY || "",
  jupiterReferralAccount: process.env.JUPITER_REFERRAL_ACCOUNT || "",
  jupiterReferralFeeBps: num(process.env.JUPITER_REFERRAL_FEE_BPS, 0),
  birdeyeApiKey: process.env.BIRDEYE_API_KEY || "",
  minVoterSol: num(process.env.MIN_VOTER_SOL, 0.01),
  voteIpSalt: process.env.VOTE_IP_SALT || "",
};

export const features = {
  voting: Boolean(env.databaseUrl),
  trading: Boolean(env.jupiterApiKey),
  customRpc: Boolean(process.env.SOLANA_RPC_URL) && !env.rpcUrl.includes("api.mainnet-beta.solana.com"),
};

/** Platform fee actually charged by ENCORE (0 unless a valid referral is configured). */
export const platformFeeBps =
  env.jupiterReferralAccount && env.jupiterReferralFeeBps >= 50 && env.jupiterReferralFeeBps <= 255
    ? env.jupiterReferralFeeBps
    : 0;
