import { NextRequest, NextResponse } from "next/server";
import {
  CAULDRON_TOKENS,
  fetchActivePools,
  aggregateReserves,
  fetchCurrentPriceSats,
} from "@/lib/providers/cauldron";
import type { AssetId } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = (req.nextUrl.searchParams.get("token") || "pusd") as AssetId;
  const tokenId = CAULDRON_TOKENS[token];
  if (!tokenId) {
    return NextResponse.json(
      { error: "token must be musd or pusd" },
      { status: 400 }
    );
  }

  try {
    const pools = await fetchActivePools(tokenId);
    const reserves = aggregateReserves(pools);
    const price = await fetchCurrentPriceSats(tokenId);

    return NextResponse.json({
      token,
      tokenId,
      poolCount: reserves.poolCount,
      totalSats: reserves.totalSats.toString(),
      totalTokens: reserves.totalTokens.toString(),
      totalBch: Number(reserves.totalSats) / 1e8,
      indexerPriceSatsPerBaseUnit: price,
      pools: pools.slice(0, 20).map((p) => ({
        pool_id: p.pool_id,
        sats: p.sats,
        tokens: p.tokens,
        txid: p.txid,
      })),
      source: "https://indexer.riften.net/cauldron",
      note: "Live pool data. Execution still requires CashTokens wallet + Cauldron SDK.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
