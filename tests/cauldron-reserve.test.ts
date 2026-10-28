import { describe, it, expect } from "vitest";
import { toReserveBigInt } from "@/lib/providers/cauldron";

describe("toReserveBigInt", () => {
  it("parses integer strings", () => {
    expect(toReserveBigInt("123456789012345").toString()).toBe("123456789012345");
  });
  it("truncates decimal strings safely", () => {
    expect(toReserveBigInt("100.9").toString()).toBe("100");
  });
  it("handles numbers under safe integer", () => {
    expect(toReserveBigInt(42).toString()).toBe("42");
  });
  it("returns 0 for empty", () => {
    expect(toReserveBigInt("").toString()).toBe("0");
    expect(toReserveBigInt(null).toString()).toBe("0");
  });
});
