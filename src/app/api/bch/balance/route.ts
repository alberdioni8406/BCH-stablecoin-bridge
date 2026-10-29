import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("address") || "";
  const address = raw.trim();
  if (!address || address.length < 15) {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }

  const bare = address.replace(/^(bitcoincash|bchtest|bchreg):/i, "");
  const candidates = [
    address,
    bare,
    address.startsWith("bitcoincash:") ? address : `bitcoincash:${bare}`,
  ];

  try {
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
              received?: number;
              transaction_count?: number;
            };
          }
        >;
      };
      const entry = data.data && Object.values(data.data)[0];
      const info = entry?.address;
      if (!info) continue;

      return NextResponse.json({
        address: addr,
        balanceSats: String(info.balance ?? 0),
        balanceBch: ((info.balance ?? 0) / 1e8).toFixed(8),
        receivedSats: String(info.received ?? 0),
        txCount: info.transaction_count ?? 0,
        source: "blockchair",
        notes:
          "Explorer hint only. Confirm spendable BCH in your wallet before leg 2.",
      });
    }
    return NextResponse.json(
      { error: "Could not fetch balance", tried: candidates },
      { status: 502 }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }
}
