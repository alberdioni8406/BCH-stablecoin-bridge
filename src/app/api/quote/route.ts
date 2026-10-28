import { NextRequest, NextResponse } from "next/server";
import { getThorQuote, toThorAsset } from "@/lib/providers/thorchain";
import {
  getCauldronQuote,
  isCauldronPair,
} from "@/lib/providers/cauldron";
import type { AssetId, NormalizedQuote } from "@/lib/types";
import { getAsset } from "@/lib/assets/registry";
import { findRoutes } from "@/lib/routing/routes";

export const dynamic = "force-dynamic";

const MODE = (process.env.NEXT_PUBLIC_APP_MODE || "prototype") as
  | "prototype"
  | "live";

function assertValidQuote(q: NormalizedQuote, label: string): void {
  if (q.isPrototypeSample && MODE === "live") {
    throw new Error(`${label}: prototype sample not allowed in live mode`);
  }
  if (!q.expectedOutput || Number(q.expectedOutput) <= 0) {
    throw new Error(`${label}: missing or non-positive expectedOutput`);
  }
  if (q.fromAsset === q.toAsset) {
    throw new Error(`${label}: from and to assets must differ`);
  }
  // expiry: if present, must be in the future (allow 30s clock skew)
  if (q.expiry != null && q.expiry < Math.floor(Date.now() / 1000) - 30) {
    throw new Error(`${label}: quote expired`);
  }
}

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from") as AssetId | null;
  const to = req.nextUrl.searchParams.get("to") as AssetId | null;
  const amount = req.nextUrl.searchParams.get("amount");
  const leg = req.nextUrl.searchParams.get("leg");

  if (!from || !to || !amount) {
    return NextResponse.json(
      { error: "Missing required params: from, to, amount" },
      { status: 400 }
    );
  }

  try {
    getAsset(from);
    getAsset(to);
  } catch {
    return NextResponse.json({ error: "Unknown asset" }, { status: 400 });
  }

  if (!/^\d*\.?\d+$/.test(amount) || Number(amount) <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const routes = findRoutes(from, to);
  if (routes.length === 0) {
    return NextResponse.json(
      { error: "No supported route for this pair", status: "UNSUPPORTED" },
      { status: 404 }
    );
  }

  const route = routes[0];

  // Explicit single-leg request
  if (route.legs.length > 1 && leg != null) {
    const legIndex = Number(leg);
    const routeLeg = route.legs[legIndex];
    if (!routeLeg) {
      return NextResponse.json({ error: "Invalid leg index" }, { status: 400 });
    }
    try {
      const q = await quoteLeg(
        routeLeg.from,
        routeLeg.to,
        amount,
        routeLeg.provider
      );
      assertValidQuote(q, `leg ${legIndex}`);
      return NextResponse.json({
        mode: MODE,
        route,
        legIndex,
        quotes: [q],
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        { error: msg, mode: MODE, status: "QUOTE_FAILED", legIndex },
        { status: 502 }
      );
    }
  }

  if (route.legs.length > 1) {
    return multiLegQuote(route, amount);
  }

  const single = route.legs[0];
  try {
    const q = await quoteLeg(from, to, amount, single.provider);
    assertValidQuote(q, "single leg");
    return NextResponse.json({
      mode: MODE,
      route,
      multiLeg: false,
      quotes: [q],
      finalQuote: q,
      intermediateAmount: null,
      finalAmount: q.expectedOutput,
      finalAsset: to,
      status: "OK",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Prototype-only soft fallback
    if (MODE === "prototype") {
      const sample = sampleQuote(from, to, amount, single.provider);
      return NextResponse.json({
        mode: "prototype",
        route,
        multiLeg: false,
        quotes: [sample],
        finalQuote: sample,
        intermediateAmount: null,
        finalAmount: sample.expectedOutput,
        finalAsset: to,
        status: "PROTOTYPE_SAMPLE",
      });
    }
    return NextResponse.json(
      { error: msg, mode: MODE, status: "QUOTE_FAILED", finalAmount: null },
      { status: 502 }
    );
  }
}

async function multiLegQuote(
  route: ReturnType<typeof findRoutes>[0],
  amount: string
) {
  const leg1 = route.legs[0];
  const leg2 = route.legs[1];

  let q1: NormalizedQuote;
  try {
    q1 = await quoteLeg(leg1.from, leg1.to, amount, leg1.provider);
    assertValidQuote(q1, "leg 1");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: `Leg 1 quote failed: ${msg}`,
        mode: MODE,
        status: "QUOTE_FAILED",
        multiLeg: true,
        route,
        quotes: [],
        finalAmount: null,
        intermediateAmount: null,
      },
      { status: 502 }
    );
  }

  // Intermediate must match leg1 destination asset (usually BCH)
  if (q1.toAsset !== leg1.to) {
    return NextResponse.json(
      {
        error: `Leg 1 asset mismatch: expected ${leg1.to}, got ${q1.toAsset}`,
        mode: MODE,
        status: "QUOTE_FAILED",
        multiLeg: true,
        finalAmount: null,
      },
      { status: 502 }
    );
  }

  const intermediateHuman = q1.expectedOutput!;

  let q2: NormalizedQuote | null = null;
  let leg2Error: string | null = null;
  try {
    q2 = await quoteLeg(leg2.from, leg2.to, intermediateHuman, leg2.provider);
    assertValidQuote(q2, "leg 2");
    if (q2.toAsset !== route.to) {
      throw new Error(
        `Leg 2 destination mismatch: expected ${route.to}, got ${q2.toAsset}`
      );
    }
  } catch (e) {
    leg2Error = e instanceof Error ? e.message : String(e);
    q2 = null;
  }

  // Critical: never present intermediate BCH as final destination amount
  const finalAmount = q2?.expectedOutput ?? null;

  return NextResponse.json({
    mode: MODE,
    route,
    multiLeg: true,
    quotes: q2 ? [q1, q2] : [q1],
    leg1: q1,
    leg2: q2,
    intermediateAmount: intermediateHuman,
    intermediateAsset: leg1.to,
    finalAmount,
    finalAsset: route.to,
    finalQuote: q2,
    leg2Error,
    notes: q2
      ? "Multi-leg estimate: leg 1 + leg 2 quoted sequentially. Legs are NOT atomic. Intermediate amount is an estimate — actual BCH received may differ."
      : `Multi-leg: leg 1 ok, leg 2 unavailable (${leg2Error}). Intermediate is not the final destination amount.`,
    status: q2 ? "OK" : "PARTIAL",
  });
}

async function quoteLeg(
  from: AssetId,
  to: AssetId,
  amount: string,
  provider: string
): Promise<NormalizedQuote> {
  if (provider === "cauldron" && isCauldronPair(from, to)) {
    return getCauldronQuote(from, to, amount);
  }

  if (provider === "thorchain" && toThorAsset(from) && toThorAsset(to)) {
    if (MODE === "live") {
      return getThorQuote(from, to, amount);
    }
    // prototype: still prefer live THOR when reachable, else sample
    try {
      return await getThorQuote(from, to, amount);
    } catch {
      return sampleQuote(from, to, amount, provider);
    }
  }

  // Live mode: never invent a quote for unsupported provider/pair
  if (MODE === "live") {
    throw new Error(
      `No live quote path for ${from} → ${to} via ${provider}. Pair unsupported or provider unavailable.`
    );
  }

  return sampleQuote(from, to, amount, provider);
}

function sampleQuote(
  from: AssetId,
  to: AssetId,
  amount: string,
  provider: string
): NormalizedQuote {
  const sampleOut = (Number(amount) * 0.985).toFixed(6);
  return {
    provider: provider as NormalizedQuote["provider"],
    fromAsset: from,
    toAsset: to,
    inputAmount: amount,
    inputAmountRaw: "0",
    expectedOutput: sampleOut,
    expectedOutputRaw: null,
    networkFee: null,
    providerFee: null,
    priceImpactBps: 15,
    minimumReceived: null,
    expiry: Math.floor(Date.now() / 1000) + 300,
    notes:
      "PROTOTYPE SAMPLE — not a live provider quote. Set NEXT_PUBLIC_APP_MODE=live for real quotes.",
    isPrototypeSample: true,
  };
}
