# BCH StableBridge

Non-custodial **route coordinator** for Bitcoin Cash stablecoins (CashTokens PUSD/MUSD) and EVM USDT.  
It prepares and tracks multi-leg flows. **It never holds user funds or private keys.**

Production: https://bch-stablecoin-bridge.vercel.app/

## Verified status (2026-10-29)

| Capability | Status | Notes |
|------------|--------|--------|
| Asset registry (contracts / category IDs) | **Implemented** | Strict allowlist |
| Live THORChain quotes | **Implemented** | `NEXT_PUBLIC_APP_MODE=live` |
| THOR prepare (inbound, router, memo) | **Implemented** | `/api/thor/prepare` — strips `bitcoincash:` for memo |
| EVM wallet connect + USDT approve/deposit | **Implemented** | eth-usdt, bsc-usdt only |
| Wait for approve before deposit | **Implemented** | |
| THOR observation polling | **Implemented** | `/api/thor/status` — not route-complete |
| BCH address balance check (explorer) | **Implemented** | `/api/bch/balance` — verify intermediate |
| Cauldron live pool quotes | **Implemented** | Riften indexer, BigInt reserves |
| Multi-leg tracker (localStorage) | **Implemented** | Distinct states; recovery hints |
| Cauldron **browser** sign + broadcast | **Not implemented** | Blocker: CashScript + wallet signer |
| Full E2E mainnet USDT→PUSD claim | **Not claimed** | Leg 2 is manual (e.g. Paytaca) |

## Modes

| Mode | Behaviour |
|------|-----------|
| `prototype` | Sample labels; no live provider calls required |
| `live` | Real THOR + Cauldron indexer quotes |

```bash
cp .env.example .env.local
# NEXT_PUBLIC_APP_MODE=live
# THORNODE_URL=https://gateway.liquify.com/chain/thorchain_api
# CAULDRON_INDEXER_URL=https://indexer.riften.net/cauldron

npm install
npm run dev
npm run test
npm run typecheck
npm run build
```

## Recommended user path (USDT → PUSD)

1. Select **eth-usdt → bch-pusd**, amount, your BCH address.
2. **Prepare** THOR deposit → **Approve** → **Deposit** (your MetaMask).
3. Wait for EVM confirm + THOR outbound; check BCH in wallet and/or `/api/bch/balance`.
4. Swap **BCH → PUSD** in **Paytaca** (in-app Cauldron) or another CashTokens wallet.
5. Record the BCH swap txid in the Tracker. Route is complete only when **you** verify PUSD.

## Architecture

- `src/lib/assets/registry.ts` — allowlist
- `src/lib/providers/thorchain*.ts` — quotes + prepare
- `src/lib/providers/cauldron.ts` — indexer + CPMM estimates
- `src/lib/providers/evmTokens.ts` — executable EVM assets
- `src/lib/bch/cauldronExecution.ts` — leg-2 readiness (honest blockers)
- `src/lib/transfer/stateMachine.ts` — client-side transfer states
- `src/components/ThorExecute.tsx` — leg-1 UI
- APIs under `src/app/api/`

## Security

- No seeds, private keys, or custodial intermediate addresses controlled by the app.
- Non-atomic multi-leg: each leg is separately signed by the user.
- Do not re-send source if leg 1 already confirmed and leg 2 fails — recover intermediate BCH.

## License

MIT
