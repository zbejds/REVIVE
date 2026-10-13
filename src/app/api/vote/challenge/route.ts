import { allow, clientIp, errorJson, json } from "@/lib/http";
import { issueChallenge, VoteError } from "@/lib/votes";

export const dynamic = "force-dynamic";

/** Step 1 of voting: get a single-use message for the wallet to sign. */
export async function POST(req: Request) {
  try {
    if (!allow(`challenge:${clientIp(req) ?? "anon"}`, 30))
      return json({ error: "Too many vote attempts. Wait a minute.", code: "rate_limited" }, { status: 429 });
    const body = (await req.json().catch(() => ({}))) as { wallet?: string; mint?: string };
    const res = await issueChallenge(String(body.wallet ?? ""), String(body.mint ?? ""));
    return json(res);
  } catch (e) {
    if (e instanceof VoteError) return json({ error: e.message, code: e.code }, { status: e.status });
    return errorJson(e);
  }
}
