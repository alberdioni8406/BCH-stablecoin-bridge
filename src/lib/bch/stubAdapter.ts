/**
 * Stub BCH wallet adapter for UI/dev without WC project id.
 * Connects with a pasted address only — cannot sign.
 */
import type {
  BchWalletAdapter,
  BchWalletSession,
  SignTransactionResult,
} from "./types";

export class StubBchWalletAdapter implements BchWalletAdapter {
  readonly id = "stub";
  private session: BchWalletSession | null = null;

  async connect(): Promise<BchWalletSession> {
    if (typeof window === "undefined") {
      throw new Error("Stub adapter is browser-only");
    }
    const address = window.prompt(
      "Phase A stub: paste your BCH address (no keys). Real signing requires WalletConnect."
    );
    if (!address || address.length < 15) {
      throw new Error("Address required");
    }
    this.session = {
      address: address.trim(),
      connected: true,
      chainId: "bch:bitcoincash",
      protocol: "stub",
    };
    return this.session;
  }

  async disconnect(): Promise<void> {
    this.session = null;
  }

  getSession(): BchWalletSession | null {
    return this.session;
  }

  async signTransaction(_wc: unknown): Promise<SignTransactionResult> {
    return {
      error:
        "Stub adapter cannot sign. Set NEXT_PUBLIC_BCH_WC=1 and implement WalletConnect adapter (Phase A → real WC).",
    };
  }
}
