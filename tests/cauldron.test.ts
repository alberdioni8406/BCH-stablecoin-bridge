import { describe, it, expect } from "vitest";
import {
  quoteConstantProduct,
  quoteBestPool,
  aggregateReserves,
  isCauldronPair,
  parseToBaseUnits,
  CAULDRON_TOKENS,
  CAULDRON_FEE_BPS,
  type CauldronPool,
} from "@/lib/providers/cauldron";
import { fromRawAmount } from "@/lib/assets/registry";

function pool(
  id: string,
  sats: number,
  tokens: number
): CauldronPool {
  return {
    pool_id: id,
    token_id: "t",
    sats,
    tokens,
    txid: "x",
    tx_pos: 0,
    owner_p2pkh_addr: "",
    owner_pkh: "",
  };
}

describe("quoteConstantProduct", () => {
  it("returns zero for zero input", () => {
    const q = quoteConstantProduct(1_000_000n, 1_000n, 0n);
    expect(q.amountOut).toBe(0n);
  });

  it("buys tokens with positive output", () => {
    const q = quoteConstantProduct(10_000_000_000n, 10_000n, 100_000_000n);
    expect(q.amountOut > 0n).toBe(true);
    expect(q.amountOut < 10_000n).toBe(true);
  });

  it("fee reduces output vs zero-fee", () => {
    const withFee = quoteConstantProduct(1_000_000n, 1_000_000n, 10_000n, 30);
    const noFee = quoteConstantProduct(1_000_000n, 1_000_000n, 10_000n, 0);
    expect(withFee.amountOut < noFee.amountOut).toBe(true);
  });

  it("uses integer arithmetic only", () => {
    const q = quoteConstantProduct(123456789n, 987654321n, 11111n);
    expect(typeof q.amountOut).toBe("bigint");
  });
});

describe("quoteBestPool — independent pools", () => {
  it("selects the pool with highest amountOut", () => {
    const pools = [
      pool("small", 1_000_000, 100), // thin
      pool("deep", 100_000_000_000, 10_000_000), // deep
    ];
    const amountIn = 10_000_000n; // 0.1 BCH in sats
    const { best, candidates } = quoteBestPool(pools, amountIn, "buyToken");
    expect(candidates.length).toBe(2);
    expect(best?.poolId).toBe("deep");
    expect(best!.amountOut > 0n).toBe(true);
  });

  it("skips pools that cannot absorb the trade", () => {
    const pools = [pool("tiny", 1000, 10)];
    const { best, candidates } = quoteBestPool(
      pools,
      5000n,
      "buyToken"
    );
    expect(candidates.length).toBe(0);
    expect(best).toBeNull();
  });

  it("sellToken direction returns sats", () => {
    const pools = [pool("p", 50_000_000, 10_000)];
    const tokensIn = 100n;
    const { best } = quoteBestPool(pools, tokensIn, "sellToken");
    expect(best).not.toBeNull();
    expect(best!.amountOut > 0n).toBe(true);
  });
});

describe("parseToBaseUnits", () => {
  it("parses BCH to sats", () => {
    expect(parseToBaseUnits("1.5", 8)).toBe(150_000_000n);
  });

  it("parses 2-decimal stablecoin", () => {
    expect(parseToBaseUnits("12.34", 2)).toBe(1234n);
  });

  it("rejects invalid characters", () => {
    expect(() => parseToBaseUnits("1.2a", 8)).toThrow();
  });

  it("handles zero fractional", () => {
    expect(parseToBaseUnits("10", 8)).toBe(1_000_000_000n);
  });
});

describe("fromRawAmount display for destination", () => {
  it("formats PUSD/MUSD with 2 decimals", () => {
    expect(fromRawAmount("1234", 2)).toBe("12.34");
    expect(fromRawAmount("100", 2)).toBe("1");
  });

  it("formats BCH with 8 decimals", () => {
    expect(fromRawAmount("150000000", 8)).toBe("1.5");
  });
});

describe("aggregateReserves", () => {
  it("sums pools for TVL display only", () => {
    const a = aggregateReserves([pool("a", 100, 10), pool("b", 50, 5)]);
    expect(a.totalSats).toBe(150n);
    expect(a.totalTokens).toBe(15n);
    expect(a.poolCount).toBe(2);
  });
});

describe("isCauldronPair", () => {
  it("accepts BCH ↔ PUSD/MUSD only", () => {
    expect(isCauldronPair("bch-native", "pusd")).toBe(true);
    expect(isCauldronPair("pusd", "bch-native")).toBe(true);
    expect(isCauldronPair("bch-native", "musd")).toBe(true);
    expect(isCauldronPair("musd", "bch-native")).toBe(true);
    expect(isCauldronPair("eth-usdt", "pusd")).toBe(false);
    expect(isCauldronPair("eth-usdt", "bch-native")).toBe(false);
  });
});

describe("category IDs and fee", () => {
  it("matches registry constants", () => {
    expect(CAULDRON_TOKENS.pusd).toBe(
      "2469acc5afa4b10cb5b5c04afb89c3a3ffd61c5da9c01e26d00951cae2a02544"
    );
    expect(CAULDRON_TOKENS.musd).toBe(
      "b38a33f750f84c5c169a6f23cb873e6e79605021585d4f3408789689ed87f366"
    );
  });

  it("fee is 30 bps (0.3%)", () => {
    expect(CAULDRON_FEE_BPS).toBe(30);
  });
});

describe("multi-leg display contract", () => {
  it("final amount must use destination decimals not BCH", () => {
    // Simulated: intermediate BCH 0.25 → PUSD base units
    const intermediateBch = "0.25";
    const bchSats = parseToBaseUnits(intermediateBch, 8);
    expect(bchSats).toBe(25_000_000n);
    // Best pool would return token base units; display with 2 decimals
    const fakePusdOut = 24_50n; // 24.50 PUSD
    const display = fromRawAmount(fakePusdOut.toString(), 2);
    expect(display).toBe("24.5");
    expect(display).not.toBe(intermediateBch);
  });
});
