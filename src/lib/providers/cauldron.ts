/**
 * Cauldron (CashTokens DEX) adapter — read-only quotes from Riften Labs indexer.
 *
 * Honest limits:
 * - Indexer provides live pool reserves (sats + token base units).
 * - We compute constant-product (x*y=k) quotes with a 0.3% fee model
 *   matching typical Cauldron pool behaviour.
 * - Transaction construction requires CashScript + a BCH wallet signer
 *   (see @mr-zwets/cauldron-swap-sdk). This module does NOT build or
 *   broadcast transactions. Execution remains disabled until a supported
 *   wallet adapter is wired.
 */

import type { AssetId, NormalizedQuote } from "@/lib/types";
import { getAsset, fromRawAmount } from "@/lib/assets/registry";

const INDEXER =
  process.env.CAULDRON_INDEXER_URL || "https://indexer.riften.net/cauldron";

/** Category IDs we support */
export const CAULDRON_TOKENS: Partial<Record<AssetId, string>> = {
  musd: "b38a33f750f84c5c169a6f23cb873e6e79605021585d4f3408789689ed87f366",
  pusd: "2469acc5afa4b10cb5b5c04afb89c3a3ffd61c5da9c01e26d00951cae2a02544",
};

export interface CauldronPool {
  pool_id: string;
  token_id: string;
  sats: number;
  tokens: number;
  txid: string;
  tx_pos: number;
  owner_p2pkh_addr: string;
  owner_pkh: string;
}

export async function fetchActivePools(tokenId: string): Promise<CauldronPool[]> {
  const url = `${INDEXER}/pool/active?token=${encodeURIComponent(tokenId)}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) {
    throw new Error(`Cauldron indexer pool/active failed (${res.status})`);
  }
  const data = (await res.json()) as { active?: CauldronPool[] };
  return data.active ?? [];
}

export async function fetchCurrentPriceSats(tokenId: string): Promise<number | null> {
  const url = `${INDEXER}/price/${encodeURIComponent(tokenId)}/current`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) return null;
  const data = (await res.json()) as { price?: number };
  return typeof data.price === "number" ? data.price : null;
}

/** Aggregate reserves across all active pools for a token */
export function aggregateReserves(pools: CauldronPool[]): {
  totalSats: bigint;
  totalTokens: bigint;
  poolCount: number;
} {
  let totalSats = BigInt(0);
  let totalTokens = BigInt(0);
  for (const p of pools) {
    totalSats += BigInt(Math.floor(p.sats));
    totalTokens += BigInt(Math.floor(p.tokens));
  }
  return { totalSats, totalTokens, poolCount: pools.length };
}

/**
 * Constant-product swap with feeBps (default 30 = 0.3%).
 * buyTokens: spend sats → receive tokens
 * sellTokens: spend tokens → receive sats
 */
export function quoteConstantProduct(
  reserveIn: bigint,
  reserveOut: bigint,
  amountIn: bigint,
  feeBps = 30
): { amountOut: bigint; priceImpactBps: number } {
  if (reserveIn <= 0n || reserveOut <= 0n || amountIn <= 0n) {
    return { amountOut: 0n, priceImpactBps: 0 };
  }
  const feeFactor = BigInt(10000 - feeBps);
  const amountInWithFee = amountIn * feeFactor;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * 10000n + amountInWithFee;
  const amountOut = numerator / denominator;

  // Spot price impact approximation
  const spot = Number(reserveOut) / Number(reserveIn);
  const effective =
    Number(amountOut) > 0 ? Number(amountOut) / Number(amountIn) : 0;
  const impact =
    spot > 0 ? Math.max(0, Math.round((1 - effective / spot) * 10000)) : 0;

  return { amountOut, priceImpactBps: impact };
}

/**
 * Quote BCH ↔ MUSD/PUSD using live aggregated pool reserves.
 * amount is human-readable string in the from-asset unit.
 */
export async function getCauldronQuote(
  from: AssetId,
  to: AssetId,
  humanAmount: string
): Promise<NormalizedQuote> {
  const fromAsset = getAsset(from);
  const toAsset = getAsset(to);

  const isBuyToken = from === "bch-native" && (to === "musd" || to === "pusd");
  const isSellToken = to === "bch-native" && (from === "musd" || from === "pusd");

  if (!isBuyToken && !isSellToken) {
    throw new Error(
      `Cauldron only supports BCH ↔ MUSD/PUSD. Got ${from} → ${to}`
    );
  }

  const tokenId = isBuyToken
    ? CAULDRON_TOKENS[to]!
    : CAULDRON_TOKENS[from]!;

  const pools = await fetchActivePools(tokenId);
  if (pools.length === 0) {
    throw new Error(`No active Cauldron pools for token ${tokenId}`);
  }

  const { totalSats, totalTokens, poolCount } = aggregateReserves(pools);
  if (totalSats === 0n || totalTokens === 0n) {
    throw new Error("Cauldron pools have zero reserves");
  }

  const num = Number(humanAmount);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error("Invalid amount");
  }

  let amountOutRaw: bigint;
  let priceImpactBps: number;
  let inputRaw: string;
  let expectedOutput: string;

  if (isBuyToken) {
    // humanAmount is BCH → convert to sats
    const satsIn = BigInt(Math.floor(num * 1e8));
    inputRaw = satsIn.toString();
    const q = quoteConstantProduct(totalSats, totalTokens, satsIn);
    amountOutRaw = q.amountOut;
    priceImpactBps = q.priceImpactBps;
    expectedOutput = fromRawAmount(amountOutRaw.toString(), toAsset.decimals);
  } else {
    // humanAmount is token → base units
    const scale = 10 ** fromAsset.decimals;
    const tokensIn = BigInt(Math.floor(num * scale));
    inputRaw = tokensIn.toString();
    const q = quoteConstantProduct(totalTokens, totalSats, tokensIn);
    amountOutRaw = q.amountOut;
    priceImpactBps = q.priceImpactBps;
    // sats → BCH human
    expectedOutput = fromRawAmount(amountOutRaw.toString(), 8);
  }

  const priceSats = await fetchCurrentPriceSats(tokenId);

  return {
    provider: "cauldron",
    fromAsset: from,
    toAsset: to,
    inputAmount: humanAmount,
    inputAmountRaw: inputRaw,
    expectedOutput,
    expectedOutputRaw: amountOutRaw.toString(),
    networkFee: null,
    providerFee: "0.3% pool fee (estimated)",
    priceImpactBps,
    minimumReceived: null,
    expiry: Math.floor(Date.now() / 1000) + 120, // short — reserves move
    notes: `Live reserves from ${poolCount} Cauldron pool(s). Indexer price ≈ ${
      priceSats != null ? priceSats.toFixed(2) : "?"
    } sats/base-unit. Quote is estimated via constant-product; actual fill depends on pool selection at sign time. Execution requires a CashTokens BCH wallet + Cauldron SDK — not yet connected.`,
    isPrototypeSample: false,
    raw: {
      poolCount,
      totalSats: totalSats.toString(),
      totalTokens: totalTokens.toString(),
      tokenId,
      indexerPriceSats: priceSats,
    },
  };
}

export function isCauldronPair(from: AssetId, to: AssetId): boolean {
  return (
    (from === "bch-native" && (to === "musd" || to === "pusd")) ||
    (to === "bch-native" && (from === "musd" || from === "pusd"))
  );
}
