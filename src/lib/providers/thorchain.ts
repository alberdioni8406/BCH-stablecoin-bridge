import type { AssetId, NormalizedQuote } from "@/lib/types";
import { getAsset, toRawAmount, fromRawAmount } from "@/lib/assets/registry";

const THOR_BASE =
  process.env.THORNODE_URL ||
  "https://gateway.liquify.com/chain/thorchain_api";

/** Map our AssetId to THORChain asset notation */
export function toThorAsset(id: AssetId): string | null {
  switch (id) {
    case "bch-native":
      return "BCH.BCH";
    case "eth-usdt":
      return "ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7";
    case "eth-usdc":
      return "ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48";
    case "bsc-usdt":
      return "BSC.USDT-0X55D398326F99059FF775485246999027B3197955";
    case "bsc-usdc":
      return "BSC.USDC-0X8AC76A51CC950D9822D68B83FE1AD97B32CD580D";
    default:
      return null; // CashTokens not supported
  }
}

/**
 * THORChain uses 1e8 for all quote amounts regardless of native decimals.
 * Convert human amount → 1e8 units for the quote API.
 */
function toThorAmount(human: string, assetDecimals: number): string {
  // Parse human to float carefully then scale to 1e8
  const num = Number(human);
  if (!Number.isFinite(num) || num <= 0) throw new Error("Invalid amount");
  // 1e8 representation
  const thorUnits = Math.floor(num * 1e8);
  return String(thorUnits);
}

function fromThorAmount(thorRaw: string, targetDecimals: number): string {
  const units = BigInt(thorRaw);
  // thor is 1e8; convert to target decimals
  // amount_human = units / 1e8
  const human = Number(units) / 1e8;
  return human.toFixed(Math.min(8, targetDecimals));
}

export async function getThorQuote(
  from: AssetId,
  to: AssetId,
  humanAmount: string
): Promise<NormalizedQuote> {
  const fromAsset = getAsset(from);
  const toAsset = getAsset(to);
  const thorFrom = toThorAsset(from);
  const thorTo = toThorAsset(to);

  if (!thorFrom || !thorTo) {
    throw new Error(
      `THORChain does not support this pair: ${from} → ${to}. CashTokens are unsupported.`
    );
  }

  const amount = toThorAmount(humanAmount, fromAsset.decimals);
  const url = `${THOR_BASE}/thorchain/quote/swap?from_asset=${encodeURIComponent(
    thorFrom
  )}&to_asset=${encodeURIComponent(thorTo)}&amount=${amount}`;

  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`THORChain quote failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    expected_amount_out?: string;
    fees?: { outbound?: string; liquidity?: string; total?: string; slippage_bps?: number };
    expiry?: number;
    inbound_address?: string;
    router?: string;
    memo?: string;
    notes?: string;
    warning?: string;
  };

  if (!data.expected_amount_out) {
    throw new Error("THORChain returned no expected_amount_out");
  }

  const expectedHuman = fromThorAmount(data.expected_amount_out, toAsset.decimals);
  const networkFee =
    data.fees?.outbound != null
      ? fromThorAmount(data.fees.outbound, toAsset.decimals)
      : null;

  return {
    provider: "thorchain",
    fromAsset: from,
    toAsset: to,
    inputAmount: humanAmount,
    inputAmountRaw: toRawAmount(humanAmount, fromAsset.decimals),
    expectedOutput: expectedHuman,
    expectedOutputRaw: toRawAmount(expectedHuman, toAsset.decimals),
    networkFee,
    providerFee:
      data.fees?.liquidity != null
        ? fromThorAmount(data.fees.liquidity, toAsset.decimals)
        : null,
    priceImpactBps: data.fees?.slippage_bps ?? null,
    minimumReceived: null, // THOR does not always surface min-out in same field
    expiry: data.expiry ?? null,
    inboundAddress: data.inbound_address,
    router: data.router,
    notes: data.notes || data.warning,
    raw: data,
    isPrototypeSample: false,
  };
}
