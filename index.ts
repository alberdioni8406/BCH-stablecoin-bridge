/** Shared types for the BCH Stablecoin Bridge Aggregator */

export type NetworkId = "bch" | "ethereum" | "bsc";

export type AssetId =
  | "bch-native"
  | "musd"
  | "pusd"
  | "eth-usdt"
  | "eth-usdc"
  | "bsc-usdt"
  | "bsc-usdc";

export type ProviderId = "thorchain" | "cauldron" | "rango";

export type VerificationStatus =
  | "VERIFIED"
  | "PARTIALLY_VERIFIED"
  | "UNSUPPORTED"
  | "NOT_TESTED";

export type TransferState =
  | "DRAFT"
  | "QUOTED"
  | "AWAITING_SIGNATURE"
  | "SUBMITTED"
  | "SOURCE_CONFIRMED"
  | "PROCESSING"
  | "DESTINATION_CONFIRMED"
  | "COMPLETED"
  | "FAILED"
  | "RECOVERY_REQUIRED";

export type AppMode = "prototype" | "live";

export interface Asset {
  id: AssetId;
  symbol: string;
  name: string;
  network: NetworkId;
  chainId: number | string;
  /** Contract address (EVM) or CashToken category ID (BCH) or "native" */
  identifier: string;
  decimals: number;
  officialSource: string;
  verificationTimestamp: string;
  verificationStatus: VerificationStatus;
  supportedProviders: ProviderId[];
  enabled: boolean;
  logoColor?: string;
}

export interface ProviderCapability {
  id: ProviderId;
  name: string;
  docsUrl: string;
  status: VerificationStatus;
  supportedChains: NetworkId[];
  supportedAssets: AssetId[];
  quoteEndpoint?: string;
  limitations: string[];
  lastChecked: string;
}

export interface NormalizedQuote {
  provider: ProviderId;
  fromAsset: AssetId;
  toAsset: AssetId;
  inputAmount: string; // human
  inputAmountRaw: string; // base units
  expectedOutput: string | null;
  expectedOutputRaw: string | null;
  networkFee: string | null;
  providerFee: string | null;
  priceImpactBps: number | null;
  minimumReceived: string | null;
  expiry: number | null; // unix seconds
  memo?: string;
  inboundAddress?: string;
  router?: string;
  notes?: string;
  raw?: unknown;
  isPrototypeSample: boolean;
}

export interface RouteLeg {
  provider: ProviderId;
  from: AssetId;
  to: AssetId;
  status: VerificationStatus;
}

export interface Route {
  id: string;
  legs: RouteLeg[];
  from: AssetId;
  to: AssetId;
  status: VerificationStatus;
  description: string;
  estimatedSettlementSeconds: number | null;
  limitations: string[];
}

export interface TransferRecord {
  id: string;
  state: TransferState;
  routeId: string;
  fromAsset: AssetId;
  toAsset: AssetId;
  amountIn: string;
  amountOutExpected: string | null;
  amountOutActual: string | null;
  sourceTxHash: string | null;
  destinationTxHash: string | null;
  intermediateAsset: AssetId | null;
  providerStatuses: Partial<Record<ProviderId, string>>;
  createdAt: string;
  updatedAt: string;
  recoveryInstructions: string | null;
  isPrototype: boolean;
}
