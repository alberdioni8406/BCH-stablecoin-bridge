# BCH StableBridge

Non-custodial cross-chain stablecoin route aggregator MVP connecting Bitcoin Cash (native BCH, MUSD, PUSD CashTokens) with USDT/USDC on Ethereum and BNB Smart Chain.

**Technical honesty > visual completeness.** This prototype proves which routes are genuinely executable and fetches live quotes where integration is verified.

## Features

- Strict asset allowlist with category IDs / contract addresses (never ticker-only)
- Route matrix with VERIFIED / PARTIALLY_VERIFIED / UNSUPPORTED status
- Live THORChain quotes for BCH ↔ ETH.USDT / BSC.USDT (and USDC where pooled)
- Prototype vs Live mode separation (no silent fake success)
- Swap UI, Route Explorer, Transaction Tracker, Provider Status, Risk disclosure
- Vercel-ready Next.js App Router + TypeScript strict

## Quick start

```bash
cp .env.example .env.local
# leave NEXT_PUBLIC_APP_MODE=prototype for sample data
# set NEXT_PUBLIC_APP_MODE=live for real THORChain quotes

npm install
npm run dev
```

Open http://localhost:3000

## Modes

| Mode | Behaviour |
|------|-----------|
| `prototype` | Labelled sample quotes; UI and state machine demos |
| `live` | Real THORNode quotes for verified EVM↔BCH pairs only |

## Architecture

- `src/lib/assets/registry.ts` — verified asset allowlist
- `src/lib/routing/routes.ts` — route matrix
- `src/lib/providers/thorchain.ts` — THORChain quote adapter
- `src/app/api/quote` — server-side quote endpoint (keys stay server-side)
- UI pages under `src/app/`

## Provider feasibility

See [docs/PROVIDER_FEASIBILITY.md](docs/PROVIDER_FEASIBILITY.md).

## Testing

```bash
npm run test
npm run typecheck
npm run build
```

## Deploy to Vercel

1. Push this repository to GitHub
2. Import project in Vercel
3. Set env vars from `.env.example` (no secrets required for public THOR endpoints)
4. Deploy

## Remaining blockers for full mainnet multi-leg execution

1. Production-grade Cauldron transaction builder + CashTokens wallet adapter (Paytaca / Cashonize / WalletConnect for BCH)
2. End-to-end monitoring of multi-leg state (source → intermediate BCH → destination)
3. Optional Rango API key for alternate EVM↔BCH routing
4. Independent verification of MUSD decimals / BCMR metadata and current contract status
5. BSC USDC exact identity confirmation before enabling

## License

MIT — see LICENSE
