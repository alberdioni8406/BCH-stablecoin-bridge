import { describe, it, expect } from "vitest";
import {
  canTransition,
  type TransferState,
} from "@/lib/transfer/stateMachine";

describe("transfer transitions", () => {
  it("allows SOURCE_CONFIRMED → AWAITING_INTERMEDIATE", () => {
    expect(canTransition("SOURCE_CONFIRMED", "AWAITING_INTERMEDIATE")).toBe(
      true
    );
  });
  it("blocks COMPLETED → QUOTED", () => {
    expect(canTransition("COMPLETED", "QUOTED")).toBe(false);
  });
  it("allows RECOVERY_REQUIRED → AWAITING_DEST_QUOTE", () => {
    expect(canTransition("RECOVERY_REQUIRED", "AWAITING_DEST_QUOTE")).toBe(
      true
    );
  });
});
