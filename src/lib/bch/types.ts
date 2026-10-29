/**
 * Shared types for BCH wallet adapter + Cauldron build (Phase A/B).
 * No private keys. Signing stays in the user wallet.
 */

export type BchNetwork = "mainnet" | "chipnet";

/** WalletConnect v2 BCH namespace methods we rely on */
export const BCH_WC_METHODS = [
  "bch_getAddresses",
  "bch_signTransaction",
  "bch_signMessage",
] as const;

export type BchWcMethod = (typeof BCH_WC_METHODS)[number];

export interface BchWalletSession {
  address: string;
  tokenAddress?: string;
  chainId: string;
  connected: boolean;
  protocol: "walletconnect" | "wizardconnect" | "stub";
}

export interface SignTransactionResult {
  /** Broadcasted txid when wallet returns it */
  txid?: string;
  /** Signed raw hex if wallet does not broadcast */
  hex?: string;
  error?: string;
}

/**
 * Non-custodial adapter: connect + sign only.
 * Implementations must never accept or store seed/WIF.
 */
export interface BchWalletAdapter {
  readonly id: string;
  connect(): Promise<BchWalletSession>;
  disconnect(): Promise<void>;
  getSession(): BchWalletSession | null;
  /** Sign a CashScript WcTransactionObject (or compatible payload) */
  signTransaction(wcTransactionObject: unknown): Promise<SignTransactionResult>;
}

export interface CauldronBuildRequest {
  network: BchNetwork;
  /** CashToken category (PUSD/MUSD) */
  tokenCategory: string;
  /** Buy this many token base units with BCH */
  buyTokenAmount: bigint;
  userBchAddress: string;
  userTokenAddress: string;
  maxSatsIn?: bigint;
  minTokensOut?: bigint;
  slippageBps: number;
}

export interface CauldronBuildResult {
  /** Payload for bch_signTransaction — opaque to UI */
  wcTransactionObject: unknown;
  totalSatsCost: string;
  expectedTokensOut: string;
  minTokensOut: string;
  feeSats: string;
  poolIds: string[];
  expiresAt: number;
  userPrompt: string;
  network: BchNetwork;
  /** Phase A/B: false until builder is wired to cauldron-swap-sdk */
  buildImplemented: boolean;
}

export interface CauldronBuilder {
  buildBuyTokens(req: CauldronBuildRequest): Promise<CauldronBuildResult>;
}
