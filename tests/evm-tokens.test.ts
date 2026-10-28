import { describe, it, expect } from "vitest";
import {
  getEvmTokenAddress,
  getEvmChainId,
  getEvmDecimals,
  isExecutableEvmAsset,
} from "@/lib/providers/evmTokens";

describe("evm token selection", () => {
  it("uses registry contract for eth-usdt not a network default", () => {
    const addr = getEvmTokenAddress("eth-usdt");
    expect(addr.toLowerCase()).toBe(
      "0xdac17f958d2ee523a2206206994597c13d831ec7"
    );
    expect(getEvmDecimals("eth-usdt")).toBe(6);
    expect(getEvmChainId("eth-usdt")).toBe(1);
  });

  it("uses different contract for bsc-usdt", () => {
    const eth = getEvmTokenAddress("eth-usdt");
    const bsc = getEvmTokenAddress("bsc-usdt");
    expect(eth.toLowerCase()).not.toBe(bsc.toLowerCase());
    expect(getEvmChainId("bsc-usdt")).toBe(56);
  });

  it("only enables USDT for execution", () => {
    expect(isExecutableEvmAsset("eth-usdt")).toBe(true);
    expect(isExecutableEvmAsset("bsc-usdt")).toBe(true);
    expect(isExecutableEvmAsset("eth-usdc")).toBe(false);
    expect(isExecutableEvmAsset("bsc-usdc")).toBe(false);
  });
});
