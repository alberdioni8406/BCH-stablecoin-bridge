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
 * THORChain quote API uses 1e8 units for all assets regardless of native decimals.
 * Convert human decimal string → 1e8 integer string via integer arithmetic.
 */
export function toThorAmount(human: string, _assetDecimals?: number): string {
  const cleaned = human.trim();
  if (!cleaned || cleaned === ".") throw new Error("Invalid amount");
  const [intPart, fracPart = ""] = cleaned.split(".");
  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(fracPart)) {
    throw new Error("Invalid amount characters");
  }
  // Scale to 1e8: take up to 8 fractional digits
  const padded = (fracPart + "0".repeat(8)).slice(0, 8);
  const whole = BigInt(intPart || "0");
  const frac = BigInt(padded || "0");
  const thorUnits = whole * 100_000_000n + frac;
  if (thorUnits <= 0n) throw new Error("Amount must be positive");
  return thorUnits.toString();
}

/**
 * Convert THOR 1e8 integer string → human string with target display decimals.
 * For BCH (8) this is exact; for assets with fewer decimals we trim trailing zeros.
 */
export function fromThorAmount(thorRaw: string, targetDecimals: number): string {
  if (!/^\d+$/.test(thorRaw)) throw new Error("Invalid THOR amount");
  // Reuse registry helper: THOR is always 1e8 scale
  return fromRawAmount(thorRaw, 8);
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
    throw new Error(
      `THORChain quote failed (${res.status}): ${text.slice(0, 200)}`
    );
  }

  const data = (await res.json()) as {
    expected_amount_out?: string;
    fees?: {
      outbound?: string;
      liquidity?: string;
      total?: string;
      slippage_bps?: number;
    };
    expiry?: number;
    inbound_address?: string;
    router?: string;
    memo?: string;
    notes?: string;
    warning?: string;
  };

  if (!data.expected_amount_out || !/^\d+$/.test(data.expected_amount_out)) {
    throw new Error("THORChain returned no valid expected_amount_out");
  }

  const outRaw = BigInt(data.expected_amount_out);
  if (outRaw <= 0n) {
    throw new Error("THORChain expected_amount_out is zero");
  }

  // THOR amounts are 1e8; convert to human for display
  const expectedHuman = fromThorAmount(data.expected_amount_out, toAsset.decimals);
  // For native decimals conversion of fees (also 1e8 on THOR)
  const networkFee =
    data.fees?.outbound != null && /^\d+$/.test(data.fees.outbound)
      ? fromThorAmount(data.fees.outbound, 8)
      : null;

  // Store expectedOutputRaw in destination native base units when possible.
  // For BCH: 1e8 already matches. For USDT (6): convert 1e8 → 1e6 via integer.
  let expectedOutputRaw: string;
  if (toAsset.decimals === 8) {
    expectedOutputRaw = data.expected_amount_out;
  } else if (toAsset.decimals < 8) {
    const scale = 10n ** BigInt(8 - toAsset.decimals);
    expectedOutputRaw = (outRaw / scale).toString();
  } else {
    const scale = 10n ** BigInt(toAsset.decimals - 8);
    expectedOutputRaw = (outRaw * scale).toString();
  }

  return {
    provider: "thorchain",
    fromAsset: from,
    toAsset: to,
    inputAmount: humanAmount,
    inputAmountRaw: toRawAmount(humanAmount, fromAsset.decimals),
    expectedOutput: expectedHuman,
    expectedOutputRaw,
    networkFee,
    providerFee:
      data.fees?.liquidity != null && /^\d+$/.test(data.fees.liquidity)
        ? fromThorAmount(data.fees.liquidity, 8)
        : null,
    priceImpactBps: data.fees?.slippage_bps ?? null,
    minimumReceived: null,
    expiry: data.expiry ?? null,
    inboundAddress: data.inbound_address,
    router: data.router,
    notes: data.notes || data.warning,
    raw: data,
    isPrototypeSample: false,
  };
}
