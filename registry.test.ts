import { describe, it, expect } from "vitest";
import {
  ASSET_REGISTRY,
  getAsset,
  toRawAmount,
  fromRawAmount,
} from "../src/lib/assets/registry";
import { ROUTES, findRoutes } from "../src/lib/routing/routes";
import { toThorAsset } from "../src/lib/providers/thorchain";

describe("Asset registry", () => {
  it("contains required category IDs", () => {
    expect(ASSET_REGISTRY.musd.identifier).toBe(
      "b38a33f750f84c5c169a6f23cb873e6e79605021585d4f3408789689ed87f366"
    );
    expect(ASSET_REGISTRY.pusd.identifier).toBe(
      "2469acc5afa4b10cb5b5c04afb89c3a3ffd61c5da9c01e26d00951cae2a02544"
    );
  });

  it("has correct ETH USDT address", () => {
    expect(ASSET_REGISTRY["eth-usdt"].identifier.toLowerCase()).toBe(
      "0xdac17f958d2ee523a2206206994597c13d831ec7"
    );
  });

  it("never enables assets without verification", () => {
    for (const a of Object.values(ASSET_REGISTRY)) {
      if (a.enabled) {
        expect(["VERIFIED", "PARTIALLY_VERIFIED"]).toContain(
          a.verificationStatus
        );
      }
    }
  });

  it("decimal conversion round-trips", () => {
    const raw = toRawAmount("1.5", 6);
    expect(raw).toBe("1500000");
    expect(fromRawAmount(raw, 6)).toBe("1.5");
  });
});

describe("Routes", () => {
  it("finds ETH USDT → PUSD multi-leg", () => {
    const r = findRoutes("eth-usdt", "pusd");
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].legs.length).toBe(2);
  });

  it("marks pure THOR routes as VERIFIED", () => {
    const r = findRoutes("eth-usdt", "bch-native");
    expect(r[0]?.status).toBe("VERIFIED");
  });
});

describe("THOR asset mapping", () => {
  it("maps known assets", () => {
    expect(toThorAsset("bch-native")).toBe("BCH.BCH");
    expect(toThorAsset("eth-usdt")).toContain("USDT");
  });
  it("rejects CashTokens", () => {
    expect(toThorAsset("musd")).toBeNull();
    expect(toThorAsset("pusd")).toBeNull();
  });
});
