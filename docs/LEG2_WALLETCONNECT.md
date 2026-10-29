# Leg 2: WalletConnect + Cauldron integration

## Phase A (this repo) — done as scaffold

- `src/lib/bch/types.ts` — adapter + build interfaces
- `src/lib/bch/config.ts` — feature flags
- `src/lib/bch/stubAdapter.ts` — address-only stub
- `src/lib/bch/walletConnectAdapter.ts` — WC v2 connect/sign scaffold
- `src/lib/bch/cauldronBuilder.ts` — stub (`buildImplemented: false`)
- `/labs/bch-wc` — manual connect + probe UI

**Broadcast remains off.** Stub cannot sign. WC needs `NEXT_PUBLIC_WC_PROJECT_ID` + `@walletconnect/sign-client`.

## Phase B — real build

1. Install: `cashscript`, `@mr-zwets/cauldron-swap-sdk`, `@walletconnect/sign-client`
2. Chipnet P2PKH self-transfer with `generateWcTransactionObject` + `bch_signTransaction`
3. `prepareBuyTokens` with `placeholderP2PKHUnlocker` (no WIF)
4. `/api/cauldron/build` returns WC object + minOut
5. Leg2 UI: preview → sign → tracker

## Phase C — product

Wire Leg2Cauldron to adapter; COMPLETED only after PUSD UTXO verified.

## Security

- Never seed/WIF in app
- Re-fetch pools before sign
- Slippage + minOut enforced in built outputs
- No COMPLETED on broadcast alone
