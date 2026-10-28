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

  const routes = findRoutes(from, to);
  if (routes.length === 0) {
    return NextResponse.json(
      { error: "No supported route for this pair", status: "UNSUPPORTED" },
      { status: 404 }
    );
  }

  const route = routes[0];

  // Explicit single-leg request (for tracker / recovery)
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

  // Multi-leg: quote leg 1, then leg 2 using intermediate expected amount
  if (route.legs.length > 1) {
    return multiLegQuote(route, amount);
  }

  // Single leg
  const single = route.legs[0];
  try {
    const q = await quoteLeg(from, to, amount, single.provider);
    return NextResponse.json({
      mode: MODE,
      route,
      multiLeg: false,
      quotes: [q],
      finalQuote: q,
      intermediateAmount: null,
      finalAmount: q.expectedOutput,
      finalAsset: to,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
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
      });
    }
    return NextResponse.json(
      { error: msg, mode: MODE, status: "QUOTE_FAILED" },
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

  // Intermediate is always human amount of leg1 output (usually BCH)
  const intermediateHuman = q1.expectedOutput;
  if (!intermediateHuman || Number(intermediateHuman) <= 0) {
    return NextResponse.json(
      {
        error: "Leg 1 returned no usable intermediate amount",
        mode: MODE,
        status: "QUOTE_FAILED",
        multiLeg: true,
        route,
        quotes: [q1],
        intermediateAmount: null,
        finalAmount: null,
        finalAsset: route.to,
      },
      { status: 502 }
    );
  }

  let q2: NormalizedQuote | null = null;
  let leg2Error: string | null = null;
  try {
    q2 = await quoteLeg(leg2.from, leg2.to, intermediateHuman, leg2.provider);
  } catch (e) {
    leg2Error = e instanceof Error ? e.message : String(e);
  }

  // Never present leg1 output as the final destination amount
  const finalAmount = q2?.expectedOutput ?? null;
  const finalQuote = q2;

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
    finalQuote,
    leg2Error,
    notes: q2
      ? "Multi-leg estimate: leg 1 + leg 2 quoted sequentially. Legs are NOT atomic. Intermediate amount is an estimate — actual BCH received may differ."
      : `Multi-leg: leg 1 ok, leg 2 unavailable (${leg2Error}). Do not treat intermediate BCH as the final destination amount.`,
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
      "PROTOTYPE SAMPLE — not a live provider quote. Set NEXT_PUBLIC_APP_MODE=live for real THOR quotes.",
    isPrototypeSample: true,
  };
}
