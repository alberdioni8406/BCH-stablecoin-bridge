/**
 * BCH WalletConnect / Cauldron leg-2 feature flags.
 * Keep broadcast disabled until chipnet E2E is proven.
 */
export const BCH_WC_ENABLED =
  process.env.NEXT_PUBLIC_BCH_WC === "1" ||
  process.env.NEXT_PUBLIC_BCH_WC === "true";

/** Never enable mainnet auto-broadcast via env alone in Phase A */
export const BCH_CAULDRON_BROADCAST_ENABLED =
  process.env.NEXT_PUBLIC_BCH_CAULDRON_BROADCAST === "1" &&
  process.env.NEXT_PUBLIC_BCH_NETWORK === "chipnet";

export type BchNetworkId = "mainnet" | "chipnet";

export function getBchNetwork(): BchNetworkId {
  const n = process.env.NEXT_PUBLIC_BCH_NETWORK;
  return n === "chipnet" ? "chipnet" : "mainnet";
}

export const BCH_WC_CHAIN = {
  mainnet: "bch:bitcoincash",
  chipnet: "bch:bchtest",
} as const;

export const WC_PROJECT_ID =
  process.env.NEXT_PUBLIC_WC_PROJECT_ID || ""; // from cloud.walletconnect.com
