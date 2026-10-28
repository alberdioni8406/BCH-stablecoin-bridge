# Provider Feasibility Report

**Date:** 2026-10-28  
**Scope:** BCH ↔ ETH/BSC USDT/USDC and BCH ↔ MUSD/PUSD routes

## A. THORChain

- **Docs:** https://dev.thorchain.org/
- **Supported chains (relevant):** Bitcoin Cash, Ethereum, BNB Smart Chain
- **Assets verified via live pools endpoint:**
  - `BCH.BCH` — Available
  - `ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7` — Available
  - `ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48` — Available
  - `BSC.USDT-0X55D398326F99059FF775485246999027B3197955` — Available
  - `BSC.USDC-0X8AC76A51CC950D9822D68B83FE1AD97B32CD580D` — Available
- **Quote API:** `GET /thorchain/quote/swap?from_asset=&to_asset=&amount=` (amounts in 1e8)
- **Live quote test:** ETH.USDT → BCH.BCH returned `expected_amount_out`, `inbound_address`, `router`, `fees`, `expiry`
- **CashTokens:** Not supported. No MUSD/PUSD pools.
- **Status:** **VERIFIED** for native BCH ↔ ETH/BSC USDT (and USDC where pooled)

## B. Cauldron Swap

- **Ecosystem:** https://thorchain.org/ecosystem (listed), primary DEX for CashTokens
- **Indexer API:** https://docs.riftenlabs.com/cauldron/API/cauldron/ (Riften Labs)
- **Unofficial SDK:** https://github.com/mr-zwets/Cauldron-Swap-SDK (`@mr-zwets/cauldron-swap-sdk`)
- **MUSD category:** `b38a33f750f84c5c169a6f23cb873e6e79605021585d4f3408789689ed87f366`
- **PUSD category:** `2469acc5afa4b10cb5b5c04afb89c3a3ffd61c5da9c01e26d00951cae2a02544` (confirmed on paryonusd.com)
- **Programmatic interface:** Pool discovery via indexer; transaction building via CashScript / unofficial SDK. No official third-party production API from Cauldron team documented for aggregators.
- **Status:** **PARTIALLY_VERIFIED** — liquidity and swaps exist on mainnet; third-party integration requires BCH wallet + covenant construction.

## C. Rango Exchange

- **Docs:** https://docs.rango.exchange/
- **BCH:** Listed as TRANSFER chain; THORChain bridge integrated.
- **CashTokens:** No evidence of category-ID recognition for MUSD/PUSD.
- **Status:** **PARTIALLY_VERIFIED** for optional EVM↔BCH routing; **UNSUPPORTED** for CashTokens.

## Route matrix summary

| From       | To         | Status              |
|-----------|------------|---------------------|
| ETH.USDT  | BCH        | VERIFIED (THOR)     |
| BSC.USDT  | BCH        | VERIFIED (THOR)     |
| BCH       | ETH.USDT   | VERIFIED (THOR)     |
| BCH       | BSC.USDT   | VERIFIED (THOR)     |
| BCH       | MUSD/PUSD  | PARTIALLY (Cauldron)|
| MUSD/PUSD | BCH        | PARTIALLY (Cauldron)|
| ETH.USDT  | MUSD/PUSD  | PARTIALLY (multi-leg)|
| BSC.USDT  | MUSD/PUSD  | PARTIALLY (multi-leg)|
| MUSD/PUSD | ETH/BSC USDT | PARTIALLY (multi-leg)|


---

## Update 2026-10-28 (Phase 2 — executable path)

### Cauldron indexer (verified live)

- Base: `https://indexer.riften.net/cauldron`
- PUSD category `2469acc5…2544`: **65+ active pools**, non-zero TVL (live check)
- MUSD category `b38a33…f366`: active pools with liquidity
- Current price endpoint returns sats-per-base-unit
- Quote model: constant-product on **aggregated** reserves + 0.3% fee estimate
- **Execution blocker remains:** `@mr-zwets/cauldron-swap-sdk` requires CashScript signer + Electrum provider; no Paytaca/Cashonize/WC BCH adapter is wired in this app yet. Signing is therefore **disabled** for Cauldron legs.

### THORChain execution prep (verified)

- Live quote via `gateway.liquify.com` returns `inbound_address`, `router`, `expected_amount_out`, `expiry`, fees
- `/api/thor/prepare` returns depositWithExpiry parameters for the user wallet
- App never holds keys; user must approve + call router from their own EVM wallet
- Outbound verification is still manual (user checks BCH balance)

### Multi-leg policy

- ETH USDT → BCH → PUSD is **PARTIALLY_VERIFIED**: leg 1 quotes + prep are live; leg 2 quotes are live from indexer; leg 2 broadcast is blocked until wallet adapter exists
- Legs are never presented as atomic
- Recovery state preserves intermediate BCH ownership with explicit user instructions

### What is genuinely executable today

| Step | Status |
|------|--------|
| Live THOR quote ETH/BSC USDT ↔ BCH | Yes |
| THOR inbound/router/memo for user wallet | Yes (prep API) |
| Live Cauldron pool discovery + estimated quote | Yes |
| Cauldron mainnet tx build + broadcast | **No** — needs BCH CashTokens wallet adapter |
| Atomic multi-leg | **No** — by design non-atomic |
| Claimed mainnet end-to-end success | **No** — not claimed |

