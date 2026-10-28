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
  /** Amount in native token decimals (string integer) */
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
  /** ERC-20 approve target = router */
  approveTarget: string | null;
  /** For depositWithExpiry: (inbound, asset, amount, memo, expiry) */
  depositArgs: {
    inboundAddress: string;
    asset: string;
    amount: string;
    memo: string;
    expiry: number;
  } | null;
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
 * SWAP:toAsset:destinationAddress
 */
export function buildSwapMemo(
  thorTo: string,
  destinationAddress: string
): string {
  return `=:${thorTo}:${destinationAddress}`;
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
  if (!destinationAddress || destinationAddress.length < 10) {
    throw new Error("Destination address required");
  }

  const amount1e8 = String(Math.floor(Number(humanAmount) * 1e8));
  const quoteUrl = `${THOR_BASE}/thorchain/quote/swap?from_asset=${encodeURIComponent(
    thorFrom
  )}&to_asset=${encodeURIComponent(thorTo)}&amount=${amount1e8}&destination=${encodeURIComponent(
    destinationAddress
  )}`;

  const res = await fetch(quoteUrl, { next: { revalidate: 0 } });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`THOR quote failed: ${t.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    inbound_address?: string;
    router?: string;
    expected_amount_out?: string;
    expiry?: number;
    fees?: unknown;
    notes?: string;
    warning?: string;
  };

  if (!data.inbound_address) {
    throw new Error("No inbound_address in quote response");
  }

  // Native amount in token decimals
  const amountNative = String(
    Math.floor(Number(humanAmount) * 10 ** fromAsset.decimals)
  );

  const memo = buildSwapMemo(thorTo, destinationAddress);
  const isEvm =
    fromAsset.network === "ethereum" || fromAsset.network === "bsc";

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
    expiry: data.expiry ?? Math.floor(Date.now() / 1000) + 600,
    expectedAmountOut: data.expected_amount_out ?? "0",
    fees: data.fees,
    notes:
      data.notes ||
      data.warning ||
      "Approve router, then depositWithExpiry. Do not send after expiry.",
    approveTarget: isEvm && data.router ? data.router : null,
    depositArgs:
      isEvm && data.router
        ? {
            inboundAddress: data.inbound_address,
            asset: fromAsset.identifier,
            amount: amountNative,
            memo,
            expiry: data.expiry ?? Math.floor(Date.now() / 1000) + 600,
          }
        : null,
  };
}
