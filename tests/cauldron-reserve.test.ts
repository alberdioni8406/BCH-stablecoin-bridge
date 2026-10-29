import { describe, it, expect } from "vitest";
import { toReserveBigInt } from "@/lib/providers/cauldron";

describe("toReserveBigInt", () => {
  it("parses integer strings", () => {
    expect(toReserveBigInt("123456789012345").toString()).toBe("123456789012345");
  });
  it("truncates decimal strings", () => {
    expect(toReserveBigInt("100.9").toString()).toBe("100");
  });
  it("handles small numbers", () => {
    expect(toReserveBigInt(42).toString()).toBe("42");
  });
  it("empty -> 0", () => {
    expect(toReserveBigInt("").toString()).toBe("0");
  });
});
