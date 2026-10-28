import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const THOR_BASE =
  process.env.THORNODE_URL ||
  "https://gateway.liquify.com/chain/thorchain_api";
const MIDGARD =
  process.env.MIDGARD_URL || "https://midgard.ninerealms.com";

/**
 * Track THORChain settlement for an EVM inbound tx hash.
 * Never marks the full route complete — only observes THOR side.
 */
export async function GET(req: NextRequest) {
  const tx = req.nextUrl.searchParams.get("tx");
  if (!tx || !/^0x[a-fA-F0-9]{64}$/.test(tx)) {
    return NextResponse.json(
      { error: "Valid EVM tx hash required (?tx=0x…)" },
      { status: 400 }
    );
  }

  try {
    const bare = tx.replace(/^0x/i, "");
    const urls = [
      `\( {MIDGARD}/v2/actions?txid= \){encodeURIComponent(tx)}`,
      `\( {MIDGARD}/v2/actions?txid= \){encodeURIComponent(bare)}`,
      `\( {THOR_BASE}/thorchain/tx/status/ \){encodeURIComponent(bare)}`,
    ];

    let midgard: unknown = null;
    let thorStatus: unknown = null;

    for (const url of urls) {
      try {
        const res = await fetch(url, { next: { revalidate: 0 } });
        if (!res.ok) continue;
        const data = await res.json();
        if (url.includes("midgard")) midgard = data;
        else thorStatus = data;
      } catch {
        /* try next */
      }
    }

    const actions = (midgard as { actions?: unknown[] })?.actions ?? [];
    const settled = actions.length > 0;

    return NextResponse.json({
      tx,
      settled,
      actionCount: actions.length,
      midgard,
      thorStatus,
      notes: settled
        ? "THOR observed this inbound. Verify BCH arrived at your destination before leg 2."
        : "Not yet observed or still pending. Do not start Cauldron until BCH is confirmed in your wallet.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
