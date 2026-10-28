import type { ProviderCapability } from "@/lib/types";

/**
 * Provider feasibility summary — see docs/PROVIDER_FEASIBILITY.md for full report.
 * Last checked: 2026-10-28
 */
export const PROVIDER_CAPABILITIES: ProviderCapability[] = [
  {
    id: "thorchain",
    name: "THORChain",
    docsUrl: "https://dev.thorchain.org/",
    status: "VERIFIED",
    supportedChains: ["bch", "ethereum", "bsc"],
    supportedAssets: ["bch-native", "eth-usdt", "eth-usdc", "bsc-usdt", "bsc-usdc"],
    quoteEndpoint: "/thorchain/quote/swap",
    limitations: [
      "Does not support CashTokens (MUSD/PUSD).",
      "BCH is intermediate only for stablecoin ↔ MUSD/PUSD multi-leg routes.",
      "Quotes expire; never cache inbound_address.",
      "Amounts in THORChain 1e8 base units for quote API.",
      "EVM deposits require router approval + depositWithExpiry.",
    ],
    lastChecked: "2026-10-29",
  },
  {
    id: "cauldron",
    name: "Cauldron Swap",
    docsUrl: "https://docs.riftenlabs.com/cauldron/API/cauldron/",
    status: "PARTIALLY_VERIFIED",
    supportedChains: ["bch"],
    supportedAssets: ["bch-native", "musd", "pusd"],
    limitations: [
      "No official first-party production SDK from Cauldron team for third-party aggregators.",
      "Unofficial SDK: @mr-zwets/cauldron-swap-sdk (CashScript-based).",
      "Indexer API (Riften Labs) provides pool discovery and prices.",
      "Live executable swap construction requires BCH wallet that can sign CashToken + covenant spends.",
      "Liquidity is thin; always check live pool depths before routing.",
      "MUSD contract status may vary (relaunch notes observed).",
    ],
    lastChecked: "2026-10-29",
  },
  {
    id: "rango",
    name: "Rango Exchange",
    docsUrl: "https://docs.rango.exchange/",
    status: "PARTIALLY_VERIFIED",
    supportedChains: ["bch", "ethereum", "bsc"],
    supportedAssets: ["bch-native", "eth-usdt", "eth-usdc", "bsc-usdt"],
    limitations: [
      "Supports BCH as TRANSFER and routes via THORChain among others.",
      "No verified support for CashToken category IDs (MUSD/PUSD).",
      "Treat as optional aggregator for EVM ↔ BCH legs only.",
      "Requires API key for production volume; public test key exists.",
    ],
    lastChecked: "2026-10-29",
  },
];
