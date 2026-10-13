import Link from "next/link";
import { Pulse } from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="mx-auto mt-20 max-w-lg text-center">
      <Pulse className="mx-auto h-14 w-14 opacity-60" />
      <h1 className="mt-4 font-display text-3xl font-black">Curtain down</h1>
      <p className="mt-2 text-bone-dim">
        That page, or that mint address, isn&apos;t in the ENCORE registry. Tokens are listed by mint only, so look-alikes won&apos;t resolve.
      </p>
      <Link href="/discover" className="btn-pulse mt-6">Browse the archive</Link>
    </div>
  );
}
