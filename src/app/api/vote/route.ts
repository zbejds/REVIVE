import { allow, clientIp, errorJson, json } from "@/lib/http";
import { castVote, VoteError } from "@/lib/votes";

export const dynamic = "force-dynamic";

/** Step 2 of voting: submit the signed challenge. */
export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    if (!allow(`vote:${ip ?? "anon"}`, 20))
      return json({ error: "Too many vote attempts. Wait a minute.", code: "rate_limited" }, { status: 429 });
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const res = await castVote({
      wallet: String(b.wallet ?? ""),
      mint: String(b.mint ?? ""),
      nonce: String(b.nonce ?? ""),
      signature: String(b.signature ?? ""),
      ip,
    });
    return json(res);
  } catch (e) {
    if (e instanceof VoteError) return json({ error: e.message, code: e.code }, { status: e.status });
    // Unique signature violation = replay of an already-recorded vote.
    if ((e as { code?: string }).code === "23505") return json({ error: "This vote was already recorded.", code: "duplicate" }, { status: 409 });
    return errorJson(e);
  }
}
