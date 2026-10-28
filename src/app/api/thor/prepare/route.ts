import { NextRequest, NextResponse } from "next/server";
import { prepareThorSwap } from "@/lib/providers/thorchainExec";
import type { AssetId } from "@/lib/types";
import { getAsset } from "@/lib/assets/registry";
import { toThorAsset } from "@/lib/providers/thorchain";

export const dynamic = "force-dynamic";

/**
 * Prepare THORChain swap parameters for the user's wallet.
 * Returns inbound address, router, memo, amounts — does NOT sign or broadcast.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const from = body.from as AssetId;
    const to = body.to as AssetId;
    const amount = String(body.amount || "");
    const destination = String(body.destination || "");

    getAsset(from);
    getAsset(to);

    if (!toThorAsset(from) || !toThorAsset(to)) {
      return NextResponse.json(
        { error: "Pair not supported on THORChain" },
        { status: 400 }
      );
    }
    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    if (!destination) {
      return NextResponse.json(
        { error: "destination address required (your BCH or EVM address)" },
        { status: 400 }
      );
    }

    const prep = await prepareThorSwap(from, to, amount, destination);
    return NextResponse.json({
      mode: process.env.NEXT_PUBLIC_APP_MODE || "prototype",
      preparation: prep,
      executionStatus: "USER_MUST_SIGN",
      steps: [
        "1. Review inbound address, router, amount, memo, and expiry.",
        "2. If ERC-20: approve router to spend the exact amount.",
        "3. Call router.depositWithExpiry(inbound, asset, amount, memo, expiry) from your wallet.",
        "4. Wait for THORChain observation and outbound to your destination address.",
        "5. Verify received balance independently before starting any second leg.",
      ],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
