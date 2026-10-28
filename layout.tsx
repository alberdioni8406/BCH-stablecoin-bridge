import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "BCH Stable Bridge — Non-custodial Aggregator",
  description:
    "Route-validation prototype connecting Bitcoin Cash CashTokens (MUSD, PUSD) with ETH/BSC USDT via THORChain and Cauldron.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <Nav />
        <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
          {children}
        </main>
        <footer className="border-t border-surface-border py-6 text-center text-sm text-gray-500">
          <p>
            Non-custodial coordinator · Does not custody funds · Provider risk applies
          </p>
          <p className="mt-1">
            Mode:{" "}
            <span className="text-bch font-mono">
              {process.env.NEXT_PUBLIC_APP_MODE || "prototype"}
            </span>
          </p>
        </footer>
      </body>
    </html>
  );
}
