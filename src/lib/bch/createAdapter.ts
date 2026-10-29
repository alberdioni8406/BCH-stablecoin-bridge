import type { BchWalletAdapter } from "./types";
import { BCH_WC_ENABLED, WC_PROJECT_ID } from "./config";
import { StubBchWalletAdapter } from "./stubAdapter";
import { WalletConnectBchAdapter } from "./walletConnectAdapter";

export function createBchWalletAdapter(): BchWalletAdapter {
  if (BCH_WC_ENABLED && WC_PROJECT_ID) {
    return new WalletConnectBchAdapter();
  }
  return new StubBchWalletAdapter();
}
