"use client";

import { http, createConfig } from "wagmi";
import { mainnet, bsc } from "wagmi/chains";
import { injected } from "wagmi/connectors";

/**
 * Minimal wagmi config for THORChain EVM leg.
 * Injected wallets only — no WalletConnect project id required.
 * Private keys never leave the user's wallet.
 */
export const wagmiConfig = createConfig({
  chains: [mainnet, bsc],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [mainnet.id]: http(),
    [bsc.id]: http(),
  },
  ssr: true,
});

export const USDT_ETH =
  "0xdAC17F958D2ee523a2206206994597C13D831ec7" as const;
export const USDT_BSC =
  "0x55d398326f99059fF775485246999027B3197955" as const;

export const THOR_ROUTER_ETH =
  "0xD37BbE5744D730a1d98d8DC97c42F0Ca46aD7146" as const;

export const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const THOR_ROUTER_ABI = [
  {
    type: "function",
    name: "depositWithExpiry",
    stateMutability: "payable",
    inputs: [
      { name: "vault", type: "address" },
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "memo", type: "string" },
      { name: "expiration", type: "uint256" },
    ],
    outputs: [],
  },
] as const;
