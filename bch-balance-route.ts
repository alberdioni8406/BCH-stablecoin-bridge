import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Read-only BCH address balance (mainnet) for intermediate receipt verification.
 * Does not sign or spend. Prefer user wallet as source of truth.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("address") || "";
  const address = raw.trim();
  if (!address || address.length < 15) {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }

  // Strip cashaddr prefix for some explorers
  const bare = address.replace(/^(bitcoincash|bchtest|bchreg):/i, "");
  const candidates = [
    address,
    bare,
    address.startsWith("bitcoincash:") ? address : `bitcoincash:${bare}`,
  ];

  try {
    // Blockchair dashboard (public, rate-limited)
    for (const addr of candidates) {
      const url = `https://api.blockchair.com/bitcoin-cash/dashboards/address/${encodeURIComponent(addr)}`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        next: { revalidate: 0 },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        data?: Record<
          string,
          {
            address?: {
              balance?: number;
              balance_usd?: number;
              received?: number;
              spent?: number;
              transaction_count?: number;
            };
          }
        >;
      };
      const entry = data.data && Object.values(data.data)[0];
      const info = entry?.address;
      if (!info) continue;

      const balanceSats = BigInt(info.balance ?? 0).toString();
      return NextResponse.json({
        address: addr,
        balanceSats,
        balanceBch: (Number(info.balance ?? 0) / 1e8).toFixed(8),
        receivedSats: String(info.received ?? 0),
        txCount: info.transaction_count ?? 0,
        source: "blockchair",
        notes:
          "Verify this matches your wallet. Do not start leg 2 until BCH is confirmed spendable.",
      });
    }

    return NextResponse.json(
      {
        error: "Could not fetch balance from public explorer",
        tried: candidates,
      },
      { status: 502 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
