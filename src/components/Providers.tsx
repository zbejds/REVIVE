"use client";

import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { usePoll } from "@/lib/client";
import type { HealthStatus } from "@/lib/types";

const HealthContext = createContext<HealthStatus | null>(null);
export const useHealth = () => useContext(HealthContext);

function HealthProvider({ children }: { children: ReactNode }) {
  const { data } = usePoll<HealthStatus>("/api/health", 5 * 60_000);
  return <HealthContext.Provider value={data}>{children}</HealthContext.Provider>;
}

export function Providers({ children }: { children: ReactNode }) {
  // The browser talks to Solana only through ENCORE's /api/rpc proxy,
  // so a private RPC key never ships to the client.
  const endpoint = useMemo(
    () => (typeof window !== "undefined" ? `${window.location.origin}/api/rpc` : "http://localhost:3000/api/rpc"),
    [],
  );
  const wallets = useMemo(() => [new PhantomWalletAdapter({ network: WalletAdapterNetwork.Mainnet })], []);

  return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: "confirmed" }}>
      <WalletProvider wallets={wallets} autoConnect>
        <HealthProvider>{children}</HealthProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
