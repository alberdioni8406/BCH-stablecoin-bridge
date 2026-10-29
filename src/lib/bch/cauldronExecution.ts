export const CAULDRON_EXECUTION = {
  browserSigningReady: false as const,
  recommendedPath:
    "After THOR delivers BCH, swap BCH → PUSD in Paytaca (in-app Cauldron), then record the txid in Tracker.",
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
    "You control any BCH at:",
    bchAddress,
    estimatedBch
      ? `Estimated intermediate: ~${estimatedBch} BCH (verify actual balance).`
      : "",
    "Complete BCH → PUSD in Paytaca Cauldron (or equivalent).",
    "Route is NOT complete until PUSD is verified in your wallet.",
  ]
    .filter(Boolean)
    .join(" ");
}
