import { describe, it, expect } from "vitest";
import { findRoutes } from "@/lib/routing/routes";
import { getAsset } from "@/lib/assets/registry";

describe("multi-leg routes", () => {
  it("ETH USDT → PUSD has two legs ending in PUSD", () => {
    const routes = findRoutes("eth-usdt", "pusd");
    expect(routes.length).toBeGreaterThan(0);
    const r = routes[0];
    expect(r.legs.length).toBe(2);
    expect(r.legs[0].to).toBe("bch-native");
    expect(r.legs[1].to).toBe("pusd");
    expect(r.to).toBe("pusd");
    expect(getAsset(r.to).symbol).toBe("PUSD");
    expect(getAsset(r.to).decimals).toBe(2);
  });

  it("ETH USDT → MUSD has two legs ending in MUSD", () => {
    const routes = findRoutes("eth-usdt", "musd");
    expect(routes.length).toBeGreaterThan(0);
    const r = routes[0];
    expect(r.legs[1].to).toBe("musd");
    expect(getAsset("musd").decimals).toBe(2);
  });

  it("direct THOR routes remain single-leg", () => {
    const routes = findRoutes("eth-usdt", "bch-native");
    expect(routes.length).toBeGreaterThan(0);
    expect(routes[0].legs.length).toBe(1);
    expect(routes[0].legs[0].provider).toBe("thorchain");
  });

  it("BCH → PUSD is single Cauldron leg", () => {
    const routes = findRoutes("bch-native", "pusd");
    expect(routes.length).toBeGreaterThan(0);
    expect(routes[0].legs.length).toBe(1);
    expect(routes[0].legs[0].provider).toBe("cauldron");
  });
});
