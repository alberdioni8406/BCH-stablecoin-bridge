import { NextRequest, NextResponse } from "next/server";
import { getThorQuote, toThorAsset } from "@/lib/providers/thorchain";
import type { AssetId } from "@/lib/types";
import { getAsset } from "@/lib/assets/registry";
import { findRoutes } from "@/lib/routing/routes";

export const dynamic = "force-dynamic";

const MODE = (process.env.NEXT_PUBLIC_APP_MODE || "prototype") as "prototype" | "live";

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from") as AssetId | null;
  const to = req.nextUrl.searchParams.get("to") as AssetId | null;
  const amount = req.nextUrl.searchParams.get("amount");

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

  // Direct THOR leg only for live quotes in this MVP
  const canThor = toThorAsset(from) && toThorAsset(to);

  if (canThor && MODE === "live") {
    try {
      const quote = await getThorQuote(from, to, amount);
      return NextResponse.json({
        mode: "live",
        route: routes[0],
        quotes: [quote],
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        { error: msg, mode: "live", status: "QUOTE_FAILED" },
        { status: 502 }
      );
    }
  }

  // Prototype / multi-leg / Cauldron-only: labelled sample or unavailable
  if (MODE === "prototype" || !canThor) {
    const sampleOut = (Number(amount) * 0.985).toFixed(6);
    return NextResponse.json({
      mode: "prototype",
      route: routes[0],
      quotes: [
        {
          provider: canThor ? "thorchain" : "cauldron",
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
            "PROTOTYPE SAMPLE — not a live provider quote. Switch NEXT_PUBLIC_APP_MODE=live for real THORChain quotes on supported pairs.",
          isPrototypeSample: true,
        },
      ],
      warning:
        routes[0].status !== "VERIFIED"
          ? "Route is only partially verified. Multi-step legs involving Cauldron require further integration."
          : undefined,
    });
  }

  return NextResponse.json(
    { error: "Live quote unavailable for this route", status: "UNSUPPORTED" },
    { status: 501 }
  );
}
