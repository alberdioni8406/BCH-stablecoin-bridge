/**
 * EVM token contract selection for THOR execution.
 * Only USDT is enabled for mainnet signing until USDC path is validated.
 */
import type { AssetId } from "@/lib/types";
import { getAsset } from "@/lib/assets/registry";

export const EXECUTABLE_EVM_ASSETS: AssetId[] = ["eth-usdt", "bsc-usdt"];

export function isExecutableEvmAsset(id: AssetId): boolean {
  return (EXECUTABLE_EVM_ASSETS as string[]).includes(id);
}

/** Checksummed contract from registry — never hardcode by network alone. */
export function getEvmTokenAddress(id: AssetId): `0x${string}` {
  const a = getAsset(id);
  if (a.network !== "ethereum" && a.network !== "bsc") {
    throw new Error(`${id} is not an EVM asset`);
  }
  if (!a.identifier.startsWith("0x") || a.identifier.length !== 42) {
    throw new Error(`Invalid contract for ${id}`);
  }
  return a.identifier as `0x${string}`;
}

export function getEvmChainId(id: AssetId): number {
  const a = getAsset(id);
  if (a.chainId == null) throw new Error(`No chainId for ${id}`);
  const n = typeof a.chainId === "number" ? a.chainId : Number(a.chainId);
  if (!Number.isFinite(n)) throw new Error(`Invalid chainId for ${id}`);
  return n;
}

export function getEvmDecimals(id: AssetId): number {
  return getAsset(id).decimals;
}
