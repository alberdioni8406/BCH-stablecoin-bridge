"use client";

/**
 * Injected MetaMask/Rabby only — no "wagmi/connectors" barrel import.
 * Avoids baseAccount → @coinbase/cdp-sdk → @x402/* Vercel build failure.
 */
import { http, createConfig, createConnector } from "wagmi";
import { mainnet, bsc } from "wagmi/chains";
import type { CreateConnectorFn } from "wagmi";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function createInjectedConnector(): CreateConnectorFn {
  // Cast: wagmi's connect() generic withCapabilities is stricter than we need for injected-only
  return createConnector((config) => ({
    id: "injected",
    name: "Injected",
    type: "injected" as const,
    async setup() {},
    async connect(parameters: {
      chainId?: number;
      isReconnecting?: boolean;
      withCapabilities?: boolean;
    } = {}) {
      const provider = await this.getProvider();
      if (!provider) {
        throw new Error("No injected wallet found (install MetaMask or Rabby)");
      }
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as `0x${string}`[];
      let currentChainId = await this.getChainId();
      if (parameters.chainId && currentChainId !== parameters.chainId) {
        try {
          await this.switchChain?.({ chainId: parameters.chainId });
          currentChainId = parameters.chainId;
        } catch {
          // user rejected switch
        }
      }
      if (parameters.withCapabilities) {
        return {
          accounts: accounts.map((address) => ({
            address,
            capabilities: {},
          })),
          chainId: currentChainId,
        };
      }
      return {
        accounts,
        chainId: currentChainId,
      };
    },
    async disconnect() {},
    async getAccounts() {
      const provider = await this.getProvider();
      if (!provider) return [] as const;
      const accounts = (await provider.request({
        method: "eth_accounts",
      })) as `0x${string}`[];
      return accounts;
    },
    async getChainId() {
      const provider = await this.getProvider();
      if (!provider) return mainnet.id;
      const hex = (await provider.request({ method: "eth_chainId" })) as string;
      return Number.parseInt(hex, 16);
    },
    async getProvider() {
      if (typeof window === "undefined") return undefined;
      return (window as unknown as { ethereum?: EthereumProvider }).ethereum;
    },
    async isAuthorized() {
      try {
        const accounts = await this.getAccounts();
        return accounts.length > 0;
      } catch {
        return false;
      }
    },
    async switchChain({ chainId }: { chainId: number }) {
      const provider = await this.getProvider();
      if (!provider) throw new Error("No provider");
      const hex = `0x\( {chainId.toString(16)}` as `0x \){string}`;
      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: hex }],
        });
      } catch (e: unknown) {
        const err = e as { code?: number };
        if (err?.code === 4902) {
          const chain = config.chains.find((c) => c.id === chainId);
          if (!chain) throw e;
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: hex,
                chainName: chain.name,
                nativeCurrency: chain.nativeCurrency,
                rpcUrls: chain.rpcUrls.default.http,
                blockExplorerUrls: chain.blockExplorers
                  ? [chain.blockExplorers.default.url]
                  : undefined,
              },
            ],
          });
        } else {
          throw e;
        }
      }
      return config.chains.find((c) => c.id === chainId) ?? mainnet;
    },
    onAccountsChanged(accounts: string[]) {
      if (accounts.length === 0) {
        config.emitter.emit("disconnect");
      } else {
        config.emitter.emit("change", {
          accounts: accounts as readonly `0x${string}`[],
        });
      }
    },
    onChainChanged(chain: string) {
      config.emitter.emit("change", {
        chainId: Number.parseInt(chain, 16),
      });
    },
    onDisconnect() {
      config.emitter.emit("disconnect");
    },
  })) as CreateConnectorFn;
}

export const wagmiConfig = createConfig({
  chains: [mainnet, bsc],
  connectors: [createInjectedConnector()],
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
