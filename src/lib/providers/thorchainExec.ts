/**
 * THORChain execution helpers — inbound address + router deposit guidance.
 * Does not sign or broadcast; returns data the user's EVM wallet must use.
 */

import type { AssetId } from "@/lib/types";
import { toThorAsset } from "./thorchain";
import { getAsset } from "@/lib/assets/registry";

const THOR_BASE =
  process.env.THORNODE_URL ||
  "https://gateway.liquify.com/chain/thorchain_api";

export interface ThorInboundInfo {
  chain: string;
  address: string;
  router?: string;
  halted: boolean;
  gas_rate?: string;
}

export interface ThorSwapPrep {
  fromAsset: AssetId;
  toAsset: AssetId;
  humanAmount: string;
  amountNative: string;
  thorFrom: string;
  thorTo: string;
  inboundAddress: string;
  router: string | null;
  memo: string;
  expiry: number;
  expectedAmountOut: string;
  fees: unknown;
  notes: string;
  approveTarget: string | null;
  depositArgs: {
    inboundAddress: string;
    asset: string;
    amount: string;
    memo: string;
    expiry: number;
  } | null;
}

/**
 * THOR memos use ":" as field separators. CashAddr prefixes like
 * "bitcoincash:qq..." must be stripped or the memo splits incorrectly:
 *   =:BCH.BCH:bitcoincash:qq...  → parser thinks destination is "bitcoincash"
 */
export function normalizeThorDestination(address: string): string {
  const trimmed = address.trim();
  if (!trimmed) throw new Error("Destination address required");

  // Strip cashaddr HRP prefixes (mainnet + testnet)
  const withoutPrefix = trimmed.replace(/^(bitcoincash|bchtest|bchreg):/i, "");

  // Reject if anything else still contains a colon (would break memo)
  if (withoutPrefix.includes(":")) {
    throw new Error(
      "Invalid destination for THOR memo: address must not contain ':' after removing bitcoincash: prefix"
    );
  }

  if (withoutPrefix.length < 15) {
    throw new Error("Destination address looks too short");
  }

  return withoutPrefix;
}

export async function fetchInboundAddresses(): Promise<ThorInboundInfo[]> {
  const res = await fetch(`${THOR_BASE}/thorchain/inbound_addresses`, {
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`inbound_addresses failed (${res.status})`);
  return (await res.json()) as ThorInboundInfo[];
}

/**
 * Build the standard THOR swap memo:
 * =:toAsset:destinationAddress
 * destinationAddress must already be normalized (no bitcoincash: prefix).
 */
export function buildSwapMemo(
  thorTo: string,
  destinationAddress: string
): string {
  const dest = normalizeThorDestination(destinationAddress);
  return `=:\( {thorTo}: \){dest}`;
}

/** Human decimal string → 1e8 integer string (THOR quote units). */
function toThor1e8(human: string): string {
  const cleaned = human.trim();
  const [intPart, fracPart = ""] = cleaned.split(".");
  if (!/^\d*\( /.test(intPart || "0") || !/^\d* \)/.test(fracPart)) {
    throw new Error("Invalid amount");
  }
  const padded = (fracPart + "0".repeat(8)).slice(0, 8);
  const whole = BigInt(intPart || "0");
  const frac = BigInt(padded || "0");
  const units = whole * 100_000_000n + frac;
  if (units <= 0n) throw new Error("Amount must be positive");
  return units.toString();
}

/** Human → native token base units (e.g. USDT 6 decimals). */
function toNativeUnits(human: string, decimals: number): string {
  const cleaned = human.trim();
  const [intPart, fracPart = ""] = cleaned.split(".");
  if (!/^\d*\( /.test(intPart || "0") || !/^\d* \)/.test(fracPart)) {
    throw new Error("Invalid amount");
  }
  const padded = (fracPart + "0".repeat(decimals)).slice(0, decimals);
  const whole = BigInt(intPart || "0");
  const frac = BigInt(padded || "0");
  const units = whole * 10n ** BigInt(decimals) + frac;
  if (units <= 0n) throw new Error("Amount must be positive");
  return units.toString();
}

/**
 * Prepare a THORChain swap for user review. Fetches a fresh quote + inbound.
 * User must approve (ERC-20) then call router.depositWithExpiry via their wallet.
 */
export async function prepareThorSwap(
  from: AssetId,
  to: AssetId,
  humanAmount: string,
  destinationAddress: string
): Promise<ThorSwapPrep> {
  const fromAsset = getAsset(from);
  const thorFrom = toThorAsset(from);
  const thorTo = toThorAsset(to);
  if (!thorFrom || !thorTo) {
    throw new Error("Pair not supported on THORChain");
  }

  // Critical: strip bitcoincash: so memo/quote destination does not break on ":"
  const dest = normalizeThorDestination(destinationAddress);

  const amount1e8 = toThor1e8(humanAmount);
  const quoteUrl = `\( {THOR_BASE}/thorchain/quote/swap?from_asset= \){encodeURIComponent(
    thorFrom
  )}&to_asset=\( {encodeURIComponent(thorTo)}&amount= \){amount1e8}&destination=${encodeURIComponent(
    dest
  )}`;

  const res = await fetch(quoteUrl, { next: { revalidate: 0 } });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`THOR quote failed: ${t.slice(0, 400)}`);
  }

  const data = (await res.json()) as {
    inbound_address?: string;
    router?: string;
    memo?: string;
    expected_amount_out?: string;
    expiry?: number;
    fees?: unknown;
    notes?: string;
    warning?: string;
  };

  if (!data.inbound_address) {
    throw new Error("No inbound_address in quote response");
  }

  const amountNative = toNativeUnits(humanAmount, fromAsset.decimals);

  // Prefer memo from THOR node when present (authoritative); else build locally
  const memo =
    data.memo && data.memo.length > 0
      ? data.memo
      : buildSwapMemo(thorTo, dest);

  const isEvm =
    fromAsset.network === "ethereum" || fromAsset.network === "bsc";

  const expiry = data.expiry ?? Math.floor(Date.now() / 1000) + 600;

  return {
    fromAsset: from,
    toAsset: to,
    humanAmount,
    amountNative,
    thorFrom,
    thorTo,
    inboundAddress: data.inbound_address,
    router: data.router ?? null,
    memo,
    expiry,
    expectedAmountOut: data.expected_amount_out ?? "0",
    fees: data.fees,
    notes:
      data.notes ||
      data.warning ||
      "Approve router, then depositWithExpiry. Do not send after expiry. BCH destination is cashaddr without bitcoincash: prefix in the memo.",
    approveTarget: isEvm && data.router ? data.router : null,
    depositArgs:
      isEvm && data.router
        ? {
            inboundAddress: data.inbound_address,
            asset: fromAsset.identifier,
            amount: amountNative,
            memo,
            expiry,
          }
        : null,
  };
}
