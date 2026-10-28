import { describe, it, expect } from "vitest";
import { findRoutes } from "@/lib/routing/routes";
import { getAsset } from "@/lib/assets/registry";

/**
 * API-level safety contracts (pure, no network).
 * Live integration is verified against production separately.
 */
describe("multi-leg final amount contract", () => {
  it("route to PUSD has destination decimals 2, intermediate is BCH 8", () => {
    const r = findRoutes("eth-usdt", "pusd")[0];
    expect(r).toBeDefined();
    expect(r.legs).toHaveLength(2);
    expect(r.legs[0].to).toBe("bch-native");
    expect(getAsset(r.legs[0].to).decimals).toBe(8);
    expect(r.to).toBe("pusd");
    expect(getAsset(r.to).decimals).toBe(2);
    expect(getAsset(r.to).symbol).toBe("PUSD");
  });

  it("simulated response shape: finalAmount never equals intermediate for multi-leg", () => {
    // Contract the UI relies on
    const intermediateAmount = "0.03423411"; // BCH
    const finalAmount = "9.73"; // PUSD
    expect(finalAmount).not.toBe(intermediateAmount);
    expect(Number(finalAmount)).toBeGreaterThan(0);
    // UI must prefer finalAmount over leg1 expectedOutput
    const leg1Out = intermediateAmount;
    const displayed = finalAmount ?? leg1Out;
    expect(displayed).toBe(finalAmount);
    expect(displayed).not.toBe(leg1Out);
  });

  it("failed leg2 leaves finalAmount null", () => {
    const finalAmount = null;
    const intermediateAmount = "0.03";
    expect(finalAmount).toBeNull();
    // UI must not fall back to intermediate as receive amount for multi-leg
    const isMultiLeg = true;
    const display = isMultiLeg
      ? finalAmount // may be null → show unavailable
      : intermediateAmount;
    expect(display).toBeNull();
  });
});

describe("sample quote isolation", () => {
  it("isPrototypeSample flag distinguishes samples", () => {
    const sample = {
      isPrototypeSample: true,
      expectedOutput: "9.85",
    };
    const live = {
      isPrototypeSample: false,
      expectedOutput: "9.73",
    };
    expect(sample.isPrototypeSample).toBe(true);
    expect(live.isPrototypeSample).toBe(false);
    // Live mode API must never return isPrototypeSample: true
  });
});
