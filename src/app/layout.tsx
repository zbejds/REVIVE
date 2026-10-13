import type { Metadata, Viewport } from "next";
import { Instrument_Sans, JetBrains_Mono, Unbounded } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Providers } from "@/components/Providers";
import { StatusBanner } from "@/components/StatusBanner";
import "./globals.css";

const display = Unbounded({ subsets: ["latin"], weight: ["500", "700", "900"], variable: "--font-display" });
const body = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-body" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: { default: "ENCORE — Every legend gets an encore", template: "%s · ENCORE" },
  description: "Call forgotten Solana memecoins back on stage: vote for the legends you want back, inspect live charts and trade with Phantom.",
};

export const viewport: Viewport = {
  themeColor: "#0D0E13",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-dvh font-sans">
        <Providers>
          <div className="relative z-10 flex min-h-dvh flex-col">
            <Header />
            <StatusBanner />
            <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pb-16 sm:px-6">{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
