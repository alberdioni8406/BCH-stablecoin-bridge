"use client";

import { http, createConfig } from "wagmi";
import { mainnet, bsc } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [mainnet, bsc],
  connectors: [injected()],
  transports: {
    [mainnet.id]: http(),
    [bsc.id]: http(),
  },
  ssr: true,
});

export const USDT_ETH = "0xdAC17F958D2ee523a2206206994597C13D831ec7" as const;
export const USDT_BSC = "0x55d398326f99059fF775485246999027B3197955" as const;

export const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const thorRouterAbi = [
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

export const ERC20_ABI = erc20Abi;
export const THOR_ROUTER_ABI = thorRouterAbi;
