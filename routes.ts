import type { Route, AssetId } from "@/lib/types";

/**
 * Route matrix — only combinations with at least one verified or partially verified leg.
 * Multi-step routes are non-atomic.
 */
export const ROUTES: Route[] = [
  {
    id: "eth-usdt-to-musd",
    from: "eth-usdt",
    to: "musd",
    legs: [
      { provider: "thorchain", from: "eth-usdt", to: "bch-native", status: "VERIFIED" },
      { provider: "cauldron", from: "bch-native", to: "musd", status: "PARTIALLY_VERIFIED" },
    ],
    status: "PARTIALLY_VERIFIED",
    description: "ETH USDT → BCH (THORChain) → MUSD (Cauldron)",
    estimatedSettlementSeconds: 600,
    limitations: [
      "Non-atomic: user receives BCH if second leg fails.",
      "Cauldron integration is partial (indexer + unofficial SDK).",
    ],
  },
  {
    id: "eth-usdt-to-pusd",
    from: "eth-usdt",
    to: "pusd",
    legs: [
      { provider: "thorchain", from: "eth-usdt", to: "bch-native", status: "VERIFIED" },
      { provider: "cauldron", from: "bch-native", to: "pusd", status: "PARTIALLY_VERIFIED" },
    ],
    status: "PARTIALLY_VERIFIED",
    description: "ETH USDT → BCH (THORChain) → PUSD (Cauldron)",
    estimatedSettlementSeconds: 600,
    limitations: ["Non-atomic multi-step.", "Cauldron partial integration."],
  },
  {
    id: "bsc-usdt-to-musd",
    from: "bsc-usdt",
    to: "musd",
    legs: [
      { provider: "thorchain", from: "bsc-usdt", to: "bch-native", status: "VERIFIED" },
      { provider: "cauldron", from: "bch-native", to: "musd", status: "PARTIALLY_VERIFIED" },
    ],
    status: "PARTIALLY_VERIFIED",
    description: "BSC USDT → BCH (THORChain) → MUSD (Cauldron)",
    estimatedSettlementSeconds: 300,
    limitations: ["Non-atomic.", "Cauldron partial."],
  },
  {
    id: "bsc-usdt-to-pusd",
    from: "bsc-usdt",
    to: "pusd",
    legs: [
      { provider: "thorchain", from: "bsc-usdt", to: "bch-native", status: "VERIFIED" },
      { provider: "cauldron", from: "bch-native", to: "pusd", status: "PARTIALLY_VERIFIED" },
    ],
    status: "PARTIALLY_VERIFIED",
    description: "BSC USDT → BCH (THORChain) → PUSD (Cauldron)",
    estimatedSettlementSeconds: 300,
    limitations: ["Non-atomic.", "Cauldron partial."],
  },
  {
    id: "musd-to-eth-usdt",
    from: "musd",
    to: "eth-usdt",
    legs: [
      { provider: "cauldron", from: "musd", to: "bch-native", status: "PARTIALLY_VERIFIED" },
      { provider: "thorchain", from: "bch-native", to: "eth-usdt", status: "VERIFIED" },
    ],
    status: "PARTIALLY_VERIFIED",
    description: "MUSD → BCH (Cauldron) → ETH USDT (THORChain)",
    estimatedSettlementSeconds: 900,
    limitations: ["Non-atomic.", "Requires BCH wallet for first leg."],
  },
  {
    id: "pusd-to-eth-usdt",
    from: "pusd",
    to: "eth-usdt",
    legs: [
      { provider: "cauldron", from: "pusd", to: "bch-native", status: "PARTIALLY_VERIFIED" },
      { provider: "thorchain", from: "bch-native", to: "eth-usdt", status: "VERIFIED" },
    ],
    status: "PARTIALLY_VERIFIED",
    description: "PUSD → BCH (Cauldron) → ETH USDT (THORChain)",
    estimatedSettlementSeconds: 900,
    limitations: ["Non-atomic.", "Requires BCH wallet for first leg."],
  },
  {
    id: "musd-to-bsc-usdt",
    from: "musd",
    to: "bsc-usdt",
    legs: [
      { provider: "cauldron", from: "musd", to: "bch-native", status: "PARTIALLY_VERIFIED" },
      { provider: "thorchain", from: "bch-native", to: "bsc-usdt", status: "VERIFIED" },
    ],
    status: "PARTIALLY_VERIFIED",
    description: "MUSD → BCH (Cauldron) → BSC USDT (THORChain)",
    estimatedSettlementSeconds: 600,
    limitations: ["Non-atomic."],
  },
  {
    id: "pusd-to-bsc-usdt",
    from: "pusd",
    to: "bsc-usdt",
    legs: [
      { provider: "cauldron", from: "pusd", to: "bch-native", status: "PARTIALLY_VERIFIED" },
      { provider: "thorchain", from: "bch-native", to: "bsc-usdt", status: "VERIFIED" },
    ],
    status: "PARTIALLY_VERIFIED",
    description: "PUSD → BCH (Cauldron) → BSC USDT (THORChain)",
    estimatedSettlementSeconds: 600,
    limitations: ["Non-atomic."],
  },
  {
    id: "eth-usdt-to-bch",
    from: "eth-usdt",
    to: "bch-native",
    legs: [
      { provider: "thorchain", from: "eth-usdt", to: "bch-native", status: "VERIFIED" },
    ],
    status: "VERIFIED",
    description: "ETH USDT → BCH (THORChain native)",
    estimatedSettlementSeconds: 120,
    limitations: [],
  },
  {
    id: "bsc-usdt-to-bch",
    from: "bsc-usdt",
    to: "bch-native",
    legs: [
      { provider: "thorchain", from: "bsc-usdt", to: "bch-native", status: "VERIFIED" },
    ],
    status: "VERIFIED",
    description: "BSC USDT → BCH (THORChain native)",
    estimatedSettlementSeconds: 60,
    limitations: [],
  },
  {
    id: "bch-to-eth-usdt",
    from: "bch-native",
    to: "eth-usdt",
    legs: [
      { provider: "thorchain", from: "bch-native", to: "eth-usdt", status: "VERIFIED" },
    ],
    status: "VERIFIED",
    description: "BCH → ETH USDT (THORChain native)",
    estimatedSettlementSeconds: 600,
    limitations: [],
  },
  {
    id: "bch-to-bsc-usdt",
    from: "bch-native",
    to: "bsc-usdt",
    legs: [
      { provider: "thorchain", from: "bch-native", to: "bsc-usdt", status: "VERIFIED" },
    ],
    status: "VERIFIED",
    description: "BCH → BSC USDT (THORChain native)",
    estimatedSettlementSeconds: 300,
    limitations: [],
  },
  {
    id: "bch-to-musd",
    from: "bch-native",
    to: "musd",
    legs: [
      { provider: "cauldron", from: "bch-native", to: "musd", status: "PARTIALLY_VERIFIED" },
    ],
    status: "PARTIALLY_VERIFIED",
    description: "BCH → MUSD (Cauldron)",
    estimatedSettlementSeconds: 30,
    limitations: ["Requires CashTokens-compatible BCH wallet.", "Liquidity dependent."],
  },
  {
    id: "bch-to-pusd",
    from: "bch-native",
    to: "pusd",
    legs: [
      { provider: "cauldron", from: "bch-native", to: "pusd", status: "PARTIALLY_VERIFIED" },
    ],
    status: "PARTIALLY_VERIFIED",
    description: "BCH → PUSD (Cauldron)",
    estimatedSettlementSeconds: 30,
    limitations: ["Requires CashTokens-compatible BCH wallet.", "Liquidity dependent."],
  },
  {
    id: "musd-to-bch",
    from: "musd",
    to: "bch-native",
    legs: [
      { provider: "cauldron", from: "musd", to: "bch-native", status: "PARTIALLY_VERIFIED" },
    ],
    status: "PARTIALLY_VERIFIED",
    description: "MUSD → BCH (Cauldron)",
    estimatedSettlementSeconds: 30,
    limitations: ["Requires CashTokens-compatible BCH wallet."],
  },
  {
    id: "pusd-to-bch",
    from: "pusd",
    to: "bch-native",
    legs: [
      { provider: "cauldron", from: "pusd", to: "bch-native", status: "PARTIALLY_VERIFIED" },
    ],
    status: "PARTIALLY_VERIFIED",
    description: "PUSD → BCH (Cauldron)",
    estimatedSettlementSeconds: 30,
    limitations: ["Requires CashTokens-compatible BCH wallet."],
  },
];

export function findRoutes(from: AssetId, to: AssetId): Route[] {
  return ROUTES.filter((r) => r.from === from && r.to === to);
}

export function getRouteById(id: string): Route | undefined {
  return ROUTES.find((r) => r.id === id);
}
