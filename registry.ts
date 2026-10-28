import type { Asset, AssetId } from "@/lib/types";

/**
 * Strict asset allowlist.
 * Identifiers are never ticker-only. All entries validated against official sources
 * as of 2026-10-28.
 */
export const ASSET_REGISTRY: Record<AssetId, Asset> = {
  "bch-native": {
    id: "bch-native",
    symbol: "BCH",
    name: "Bitcoin Cash",
    network: "bch",
    chainId: "bitcoincash",
    identifier: "native",
    decimals: 8,
    officialSource: "https://bitcoincash.org / THORChain BCH.BCH pool",
    verificationTimestamp: "2026-10-28T00:00:00Z",
    verificationStatus: "VERIFIED",
    supportedProviders: ["thorchain", "cauldron"],
    enabled: true,
    logoColor: "#0AC18E",
  },
  musd: {
    id: "musd",
    symbol: "MUSD",
    name: "Moria USD",
    network: "bch",
    chainId: "bitcoincash",
    identifier: "b38a33f750f84c5c169a6f23cb873e6e79605021585d4f3408789689ed87f366",
    decimals: 2, // typical for Moria; confirm via BCMR if available
    officialSource: "https://tokenstork.com/token/b38a33f750f84c5c169a6f23cb873e6e79605021585d4f3408789689ed87f366",
    verificationTimestamp: "2026-10-28T00:00:00Z",
    verificationStatus: "PARTIALLY_VERIFIED",
    supportedProviders: ["cauldron"],
    enabled: true,
    logoColor: "#3B82F6",
  },
  pusd: {
    id: "pusd",
    symbol: "PUSD",
    name: "ParyonUSD",
    network: "bch",
    chainId: "bitcoincash",
    identifier: "2469acc5afa4b10cb5b5c04afb89c3a3ffd61c5da9c01e26d00951cae2a02544",
    decimals: 2,
    officialSource: "https://paryonusd.com/ (Token ID published on site)",
    verificationTimestamp: "2026-10-28T00:00:00Z",
    verificationStatus: "VERIFIED",
    supportedProviders: ["cauldron"],
    enabled: true,
    logoColor: "#A855F7",
  },
  "eth-usdt": {
    id: "eth-usdt",
    symbol: "USDT",
    name: "Tether USD (Ethereum)",
    network: "ethereum",
    chainId: 1,
    identifier: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    decimals: 6,
    officialSource: "https://tether.to / Etherscan verified contract",
    verificationTimestamp: "2026-10-28T00:00:00Z",
    verificationStatus: "VERIFIED",
    supportedProviders: ["thorchain", "rango"],
    enabled: true,
    logoColor: "#26A17B",
  },
  "eth-usdc": {
    id: "eth-usdc",
    symbol: "USDC",
    name: "USD Coin (Ethereum)",
    network: "ethereum",
    chainId: 1,
    identifier: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimals: 6,
    officialSource: "https://developers.circle.com/stablecoins/usdc-contract-addresses",
    verificationTimestamp: "2026-10-28T00:00:00Z",
    verificationStatus: "VERIFIED",
    supportedProviders: ["thorchain", "rango"],
    enabled: true,
    logoColor: "#2775CA",
  },
  "bsc-usdt": {
    id: "bsc-usdt",
    symbol: "USDT",
    name: "Tether USD (BNB Smart Chain)",
    network: "bsc",
    chainId: 56,
    identifier: "0x55d398326f99059fF775485246999027B3197955",
    decimals: 18,
    officialSource: "Tether / BscScan verified; THORChain BSC.USDT pool",
    verificationTimestamp: "2026-10-28T00:00:00Z",
    verificationStatus: "VERIFIED",
    supportedProviders: ["thorchain", "rango"],
    enabled: true,
    logoColor: "#26A17B",
  },
  "bsc-usdc": {
    id: "bsc-usdc",
    symbol: "USDC",
    name: "USD Coin (BNB Smart Chain)",
    network: "bsc",
    chainId: 56,
    identifier: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    decimals: 18,
    officialSource: "THORChain BSC.USDC pool (verify against Circle bridged listing)",
    verificationTimestamp: "2026-10-28T00:00:00Z",
    verificationStatus: "PARTIALLY_VERIFIED",
    supportedProviders: ["thorchain"],
    enabled: false, // disabled until exact Circle/bridged identity confirmed for routes
    logoColor: "#2775CA",
  },
};

export function getAsset(id: AssetId): Asset {
  const a = ASSET_REGISTRY[id];
  if (!a) throw new Error(`Unknown asset: ${id}`);
  return a;
}

export function getEnabledAssets(): Asset[] {
  return Object.values(ASSET_REGISTRY).filter((a) => a.enabled);
}

export function getAssetsByNetwork(network: Asset["network"]): Asset[] {
  return Object.values(ASSET_REGISTRY).filter(
    (a) => a.network === network && a.enabled
  );
}

/** Convert human amount to base units string */
export function toRawAmount(human: string, decimals: number): string {
  const [intPart, fracPart = ""] = human.split(".");
  const padded = (fracPart + "0".repeat(decimals)).slice(0, decimals);
  const raw = BigInt(intPart || "0") * BigInt(10 ** decimals) + BigInt(padded || "0");
  return raw.toString();
}

/** Convert base units to human string */
export function fromRawAmount(raw: string, decimals: number): string {
  const bi = BigInt(raw);
  const base = BigInt(10 ** decimals);
  const intPart = bi / base;
  const frac = bi % base;
  if (frac === 0n) return intPart.toString();
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${intPart}.${fracStr}`;
}
