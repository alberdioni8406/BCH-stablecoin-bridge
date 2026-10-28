import { describe, it, expect } from "vitest";
import {
  normalizeThorDestination,
  buildSwapMemo,
} from "@/lib/providers/thorchainExec";

describe("normalizeThorDestination", () => {
  it("strips bitcoincash: prefix", () => {
    const n = normalizeThorDestination(
      "bitcoincash:qqt2ld5vzcxhyqnz5csstz9ytq2u6l9m0cc7qwmvsl"
    );
    expect(n).toBe("qqt2ld5vzcxhyqnz5csstz9ytq2u6l9m0cc7qwmvsl");
    expect(n.includes(":")).toBe(false);
  });

  it("accepts bare cashaddr body", () => {
    const n = normalizeThorDestination(
      "qqt2ld5vzcxhyqnz5csstz9ytq2u6l9m0cc7qwmvsl"
    );
    expect(n.startsWith("q")).toBe(true);
  });

  it("memo does not embed bitcoincash: prefix", () => {
    const memo = buildSwapMemo(
      "BCH.BCH",
      "bitcoincash:qqt2ld5vzcxhyqnz5csstz9ytq2u6l9m0cc7qwmvsl"
    );
    expect(memo).toBe(
      "=:BCH.BCH:qqt2ld5vzcxhyqnz5csstz9ytq2u6l9m0cc7qwmvsl"
    );
    expect(memo.includes("bitcoincash")).toBe(false);
  });
});
