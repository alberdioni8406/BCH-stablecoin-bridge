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

  if (route.legs.length > 1) {
    const first = route.legs[0];
    try {
      const q1 = await quoteLeg(first.from, first.to, amount, first.provider);
      return NextResponse.json({
        mode: MODE,
        route,
        multiLeg: true,
        quotes: [q1],
        notes:
          "Multi-leg route. First-leg quote shown. Second leg is quoted after intermediate asset is received. Legs are NOT atomic.",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        { error: msg, mode: MODE, status: "QUOTE_FAILED" },
        { status: 502 }
      );
    }
  }

  const single = route.legs[0];
  try {
    const q = await quoteLeg(from, to, amount, single.provider);
    return NextResponse.json({
      mode: MODE,
      route,
      quotes: [q],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (MODE === "prototype") {
      return NextResponse.json({
        mode: "prototype",
        route,
        quotes: [sampleQuote(from, to, amount, single.provider)],
      });
    }
    return NextResponse.json(
      { error: msg, mode: MODE, status: "QUOTE_FAILED" },
      { status: 502 }
    );
  }
}

async function quoteLeg(
  from: AssetId,
  to: AssetId,
  amount: string,
  provider: string
): Promise<NormalizedQuote> {
  // Cauldron: always use live indexer when possible (read-only, safe)
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
