/**
 * Cauldron leg-2 execution status (honest).
 * No simulated broadcast. Browser CashTokens signing not wired yet.
 */

export const CAULDRON_EXECUTION = {
  browserSigningReady: false as const,
  recommendedPath:
    "After THOR delivers BCH to your address, open Paytaca (or another CashTokens wallet with Cauldron) and swap BCH → PUSD yourself. Then mark leg 2 complete in the Tracker with the BCH txid.",
  sdkCandidates: [
    {
      name: "@mr-zwets/cauldron-swap-sdk",
      role: "Build multi-pool buy/sell txs via CashScript",
      blocker:
        "Requires ElectrumNetworkProvider + signing key; no browser WC signer wired",
    },
    {
      name: "@cashlab/cauldron",
      role: "Alternative trade construction",
      blocker: "Same signer requirement",
    },
    {
      name: "Paytaca in-app Cauldron",
      role: "User-controlled swap of intermediate BCH",
      blocker: null,
    },
  ],
  categoryIds: {
    pusd: "2469acc5afa4b10cb5b5c04afb89c3a3ffd61c5da9c01e26d00951cae2a02544",
    musd: "b38a33f750f84c5c169a6f23cb873e6e79605021585d4f3408789689ed87f366",
  },
};

export function leg2RecoveryHint(
  bchAddress: string,
  estimatedBch?: string
): string {
  return [
    "Leg 1 succeeded or is settling. You control any BCH at:",
    bchAddress,
    estimatedBch
      ? `Estimated intermediate: \~${estimatedBch} BCH (verify actual balance).`
      : "",
    "Do not rely on the estimate for size.",
    "Complete BCH → PUSD in Paytaca Cauldron (or equivalent).",
    "Save the swap txid in the Tracker. Route is NOT complete until PUSD balance is verified.",
  ]
    .filter(Boolean)
    .join(" ");
}
