import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TokenView } from "@/components/TokenView";
import { categoryLabel, getToken, isListedMint, relatedTokens } from "@/lib/registry";

type Props = { params: Promise<{ mint: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { mint } = await params;
  const t = getToken(mint);
  return t ? { title: `${t.symbol} — ${t.name}`, description: t.blurb } : { title: "Token not found" };
}

export default async function TokenPage({ params }: Props) {
  const { mint } = await params;
  const token = getToken(mint);
  if (!token) return notFound();

  if (!isListedMint(mint)) {
    return (
      <div className="mx-auto mt-16 max-w-xl text-center">
        <p className="label">In the vault</p>
        <h1 className="mt-2 font-display text-3xl font-black">{token.symbol} isn&apos;t listed</h1>
        <p className="mt-3 text-bone-dim">{token.notListedReason ?? "This token is not part of the ENCORE market."}</p>
        <Link href="/discover" className="btn-ghost mt-6">Back to the archive</Link>
      </div>
    );
  }

  return (
    <TokenView
      token={token}
      categoryLabels={token.categories.map(categoryLabel)}
      related={relatedTokens(mint).map((t) => ({ mint: t.mint, symbol: t.symbol, name: t.name, era: t.era }))}
    />
  );
}
