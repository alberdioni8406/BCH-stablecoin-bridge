import { describe, it, expect } from "vitest";
import {
  quoteConstantProduct,
  aggregateReserves,
  isCauldronPair,
  CAULDRON_TOKENS,
  type CauldronPool,
} from "@/lib/providers/cauldron";

describe("Cauldron constant-product quote", () => {
  it("returns zero for zero input", () => {
    const q = quoteConstantProduct(1_000_000n, 1_000n, 0n);
    expect(q.amountOut).toBe(0n);
  });

  it("buys tokens with positive output", () => {
    // 100 BCH (1e10 sats) pool, 10000 tokens
    const reserveSats = 10_000_000_000n;
    const reserveTokens = 10_000n;
    const satsIn = 100_000_000n; // 1 BCH
    const q = quoteConstantProduct(reserveSats, reserveTokens, satsIn);
    expect(q.amountOut > 0n).toBe(true);
    expect(q.amountOut < reserveTokens).toBe(true);
  });

  it("fee reduces output vs zero-fee", () => {
    const rIn = 1_000_000n;
    const rOut = 1_000_000n;
    const amt = 10_000n;
    const withFee = quoteConstantProduct(rIn, rOut, amt, 30);
    const noFee = quoteConstantProduct(rIn, rOut, amt, 0);
    expect(withFee.amountOut < noFee.amountOut).toBe(true);
  });
});

describe("aggregateReserves", () => {
  it("sums pools", () => {
    const pools: CauldronPool[] = [
      {
        pool_id: "a",
        token_id: "t",
        sats: 100,
        tokens: 10,
        txid: "x",
        tx_pos: 0,
        owner_p2pkh_addr: "",
        owner_pkh: "",
      },
      {
        pool_id: "b",
        token_id: "t",
        sats: 50,
        tokens: 5,
        txid: "y",
        tx_pos: 1,
        owner_p2pkh_addr: "",
        owner_pkh: "",
      },
    ];
    const a = aggregateReserves(pools);
    expect(a.totalSats).toBe(150n);
    expect(a.totalTokens).toBe(15n);
    expect(a.poolCount).toBe(2);
  });
});

describe("isCauldronPair", () => {
  it("accepts BCH ↔ PUSD/MUSD", () => {
    expect(isCauldronPair("bch-native", "pusd")).toBe(true);
    expect(isCauldronPair("pusd", "bch-native")).toBe(true);
    expect(isCauldronPair("bch-native", "musd")).toBe(true);
    expect(isCauldronPair("eth-usdt", "pusd")).toBe(false);
  });
});

describe("category IDs", () => {
  it("matches registry constants", () => {
    expect(CAULDRON_TOKENS.pusd).toBe(
      "2469acc5afa4b10cb5b5c04afb89c3a3ffd61c5da9c01e26d00951cae2a02544"
    );
    expect(CAULDRON_TOKENS.musd).toBe(
      "b38a33f750f84c5c169a6f23cb873e6e79605021585d4f3408789689ed87f366"
    );
  });
});
