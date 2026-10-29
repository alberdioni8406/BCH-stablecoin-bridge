/**
 * Cauldron transaction builder — Phase A stub.
 * Phase B: wire @mr-zwets/cauldron-swap-sdk + placeholderP2PKHUnlocker
 * + generateWcTransactionObject (cashscript).
 */
import type {
  CauldronBuilder,
  CauldronBuildRequest,
  CauldronBuildResult,
} from "./types";
import { BCH_CAULDRON_BROADCAST_ENABLED } from "./config";

export class StubCauldronBuilder implements CauldronBuilder {
  async buildBuyTokens(req: CauldronBuildRequest): Promise<CauldronBuildResult> {
    if (BCH_CAULDRON_BROADCAST_ENABLED) {
      // Still not implemented — explicit fail
      throw new Error(
        "Cauldron build+broadcast not implemented. Complete Phase B (cauldron-swap-sdk)."
      );
    }
    return {
      wcTransactionObject: null,
      totalSatsCost: "0",
      expectedTokensOut: "0",
      minTokensOut: req.minTokensOut?.toString() ?? "0",
      feeSats: "0",
      poolIds: [],
      expiresAt: Math.floor(Date.now() / 1000) + 120,
      userPrompt: "Phase A: builder not connected",
      network: req.network,
      buildImplemented: false,
    };
  }
}

export function createCauldronBuilder(): CauldronBuilder {
  return new StubCauldronBuilder();
}
