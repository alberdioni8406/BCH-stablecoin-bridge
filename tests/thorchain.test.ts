import { describe, it, expect } from "vitest";
import { toThorAmount, fromThorAmount, toThorAsset } from "@/lib/providers/thorchain";

describe("toThorAmount — integer 1e8", () => {
  it("converts whole BCH", () => {
    expect(toThorAmount("1")).toBe("100000000");
  });

  it("converts fractional without float", () => {
    expect(toThorAmount("0.03423411")).toBe("3423411");
  });

  it("converts USDT-style human amount", () => {
    expect(toThorAmount("10")).toBe("1000000000");
  });

  it("rejects zero and invalid", () => {
    expect(() => toThorAmount("0")).toThrow();
    expect(() => toThorAmount("abc")).toThrow();
  });
});

describe("fromThorAmount", () => {
  it("formats 1e8 back to human", () => {
    expect(fromThorAmount("3423411", 8)).toBe("0.03423411");
    expect(fromThorAmount("100000000", 8)).toBe("1");
  });
});

describe("toThorAsset", () => {
  it("maps EVM and BCH, rejects CashTokens", () => {
    expect(toThorAsset("eth-usdt")).toContain("ETH.USDT");
    expect(toThorAsset("bch-native")).toBe("BCH.BCH");
    expect(toThorAsset("pusd")).toBeNull();
    expect(toThorAsset("musd")).toBeNull();
  });
});
