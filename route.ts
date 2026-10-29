import { NextRequest, NextResponse } from "next/server";
import { getCauldronQuote, CAULDRON_TOKENS } from "@/lib/providers/cauldron";
import type { AssetId } from "@/lib/types";
import { getAsset } from "@/lib/assets/registry";

export const dynamic = "force-dynamic";

/**
 * Fresh Cauldron estimate for BCH ↔ PUSD/MUSD.
 * Does not build or broadcast a swap transaction.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const from = body.from as AssetId;
    const to = body.to as AssetId;
    const amount = String(body.amount || "");

    getAsset(from);
    getAsset(to);

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const quote = await getCauldronQuote(from, to, amount);
    const tokenAsset = from === "bch-native" ? to : from;
    const categoryId = CAULDRON_TOKENS[tokenAsset] ?? null;

    return NextResponse.json({
      mode: process.env.NEXT_PUBLIC_APP_MODE || "prototype",
      quote,
      categoryId,
      executableInBrowser: false,
      executionGuidance: [
        "Confirm the BCH (or token) amount is spendable in your CashTokens wallet.",
        "Open Paytaca (or equivalent) Cauldron and swap with your own signature.",
        "Match the category ID below when selecting PUSD/MUSD.",
        "After confirmation, paste the BCH txid in the Tracker and verify PUSD balance.",
      ],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
