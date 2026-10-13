import { env, features, platformFeeBps } from "@/lib/env";
import { json } from "@/lib/http";
import type { HealthStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const body: HealthStatus = {
    voting: features.voting,
    trading: features.trading,
    rpc: features.customRpc ? "custom" : "public",
    charts: env.birdeyeApiKey ? "birdeye" : "geckoterminal",
    platformFeeBps,
    minVoterSol: env.minVoterSol,
  };
  return json(body, { maxAge: 60 });
}
