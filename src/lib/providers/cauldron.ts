/**
 * Cauldron (CashTokens DEX) adapter — read-only quotes from Riften Labs indexer.
 *
 * Model (verified against https://docs.riftenlabs.com/cauldron/swap/):
 * - Micro-pools: each pool is an independent CPMM UTXO (tokens * sats = k).
 * - Fee: ~0.3% to LPs — contract uses abs(Δsats) * 3 / 1000.
 * - Trades may span multiple pools; for estimates we quote each pool
 *   independently and pick the best single-pool output (conservative).
 * - Does NOT build or broadcast transactions.
 */

import type { AssetId, NormalizedQuote } from "@/lib/types";
import { getAsset, fromRawAmount } from "@/lib/assets/registry";


/** Parse indexer reserve fields as BigInt without float precision loss. */
export function toReserveBigInt(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return 0n;
    if (value > Number.MAX_SAFE_INTEGER) {
      throw new Error("Reserve exceeds JS safe integer — expected string from indexer");
    }
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string") {
    const cleaned = value.trim().split(".")[0]?.replace(/[^0-9-]/g, "") || "0";
    if (!cleaned || cleaned === "-") return 0n;
    return BigInt(cleaned);
  }
  return 0n;
}

const INDEXER =
  process.env.CAULDRON_INDEXER_URL || "https://indexer.riften.net/cauldron";

/** Category IDs — must match registry */
export const CAULDRON_TOKENS: Partial<Record<AssetId, string>> = {
  musd: "b38a33f750f84c5c169a6f23cb873e6e79605021585d4f3408789689ed87f366",
  pusd: "2469acc5afa4b10cb5b5c04afb89c3a3ffd61c5da9c01e26d00951cae2a02544",
};

/** LP fee: 0.3% → 30 bps (docs: abs(deltaSats) * 3 / 1000) */
export const CAULDRON_FEE_BPS = 30;

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

export function aggregateReserves(pools: CauldronPool[]): {
  totalSats: bigint;
  totalTokens: bigint;
  poolCount: number;
} {
  let totalSats = BigInt(0);
  let totalTokens = BigInt(0);
  for (const p of pools) {
    totalSats += toReserveBigInt(p.sats);
    totalTokens += toReserveBigInt(p.tokens);
  }
  return { totalSats, totalTokens, poolCount: pools.length };
}

/**
 * Constant-product swap with fee on input (approximation of Cauldron fee).
 * All values are integer base units (sats or token base units).
 */
export function quoteConstantProduct(
  reserveIn: bigint,
  reserveOut: bigint,
  amountIn: bigint,
  feeBps = CAULDRON_FEE_BPS
): { amountOut: bigint; priceImpactBps: number } {
  if (reserveIn <= 0n || reserveOut <= 0n || amountIn <= 0n) {
    return { amountOut: 0n, priceImpactBps: 0 };
  }
  const feeFactor = BigInt(10000 - feeBps);
  const amountInWithFee = amountIn * feeFactor;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * 10000n + amountInWithFee;
  if (denominator === 0n) return { amountOut: 0n, priceImpactBps: 0 };
  const amountOut = numerator / denominator;

  let priceImpactBps = 0;
  if (amountIn > 0n && reserveOut > 0n) {
    const idealOut = (amountIn * reserveOut) / reserveIn;
    if (idealOut > amountOut && idealOut > 0n) {
      priceImpactBps = Number(((idealOut - amountOut) * 10000n) / idealOut);
    }
  }

  return { amountOut, priceImpactBps };
}

export interface PoolQuoteResult {
  poolId: string;
  amountOut: bigint;
  priceImpactBps: number;
  reserveIn: bigint;
  reserveOut: bigint;
}

/**
 * Quote each pool independently; return the best amountOut.
 */
export function quoteBestPool(
  pools: CauldronPool[],
  amountIn: bigint,
  direction: "buyToken" | "sellToken"
): { best: PoolQuoteResult | null; candidates: PoolQuoteResult[] } {
  const candidates: PoolQuoteResult[] = [];

  for (const p of pools) {
    const sats = toReserveBigInt(p.sats);
    const tokens = toReserveBigInt(p.tokens);
    if (sats <= 0n || tokens <= 0n) continue;

    let reserveIn: bigint;
    let reserveOut: bigint;
    if (direction === "buyToken") {
      reserveIn = sats;
      reserveOut = tokens;
    } else {
      reserveIn = tokens;
      reserveOut = sats;
    }

    if (amountIn >= reserveIn) continue;

    const q = quoteConstantProduct(reserveIn, reserveOut, amountIn);
    if (q.amountOut <= 0n) continue;

    candidates.push({
      poolId: p.pool_id,
      amountOut: q.amountOut,
      priceImpactBps: q.priceImpactBps,
      reserveIn,
      reserveOut,
    });
  }

  candidates.sort((a, b) =>
    a.amountOut > b.amountOut ? -1 : a.amountOut < b.amountOut ? 1 : 0
  );

  return { best: candidates[0] ?? null, candidates };
}

/** Parse human amount to integer base units without float for the integer part. */
export function parseToBaseUnits(human: string, decimals: number): bigint {
  const cleaned = human.trim();
  if (!cleaned || cleaned === ".") throw new Error("Invalid amount");
  const [intPart, fracPart = ""] = cleaned.split(".");
  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(fracPart)) {
    throw new Error("Invalid amount characters");
  }
  const padded = (fracPart + "0".repeat(decimals)).slice(0, decimals);
  const whole = BigInt(intPart || "0");
  const frac = BigInt(padded || "0");
  const base = 10n ** BigInt(decimals);
  return whole * base + frac;
}

/**
 * Quote BCH ↔ MUSD/PUSD using per-pool CPMM and best single-pool fill.
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

  const direction = isBuyToken ? "buyToken" : "sellToken";
  const amountIn = parseToBaseUnits(
    humanAmount,
    isBuyToken ? 8 : fromAsset.decimals
  );

  if (amountIn <= 0n) {
    throw new Error("Amount must be positive");
  }

  const { best, candidates } = quoteBestPool(pools, amountIn, direction);

  if (!best) {
    throw new Error(
      "No single pool can absorb this trade size without draining reserves. Try a smaller amount."
    );
  }

  const expectedOutput = isBuyToken
    ? fromRawAmount(best.amountOut.toString(), toAsset.decimals)
    : fromRawAmount(best.amountOut.toString(), 8);

  const { totalSats, totalTokens, poolCount } = aggregateReserves(pools);
  const priceSats = await fetchCurrentPriceSats(tokenId);

  return {
    provider: "cauldron",
    fromAsset: from,
    toAsset: to,
    inputAmount: humanAmount,
    inputAmountRaw: amountIn.toString(),
    expectedOutput,
    expectedOutputRaw: best.amountOut.toString(),
    networkFee: null,
    providerFee: "0.3% LP fee (per Cauldron docs)",
    priceImpactBps: best.priceImpactBps,
    minimumReceived: null,
    expiry: Math.floor(Date.now() / 1000) + 120,
    notes: `Best single-pool estimate among ${candidates.length}/${poolCount} active pools (pool ${best.poolId.slice(0, 8)}…). Multi-pool routing at execution may improve fill. Indexer spot ≈ ${
      priceSats != null ? priceSats.toFixed(2) : "?"
    } sats/base-unit. Not executable until a CashTokens wallet signs.`,
    isPrototypeSample: false,
    raw: {
      method: "best_single_pool",
      poolCount,
      candidateCount: candidates.length,
      bestPoolId: best.poolId,
      totalSats: totalSats.toString(),
      totalTokens: totalTokens.toString(),
      tokenId,
      indexerPriceSats: priceSats,
      feeBps: CAULDRON_FEE_BPS,
    },
  };
}

export function isCauldronPair(from: AssetId, to: AssetId): boolean {
  return (
    (from === "bch-native" && (to === "musd" || to === "pusd")) ||
    (to === "bch-native" && (from === "musd" || from === "pusd"))
  );
}
