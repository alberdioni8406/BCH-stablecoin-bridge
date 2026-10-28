import { ROUTES } from "@/lib/routing/routes";
import { getAsset } from "@/lib/assets/registry";
import clsx from "clsx";

export default function RoutesPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Route Explorer</h1>
      <p className="text-gray-400 mb-8 max-w-2xl">
        All routes currently registered in the allowlist. Status reflects real
        provider investigation — not assumed support.
      </p>
      <div className="overflow-x-auto rounded-xl border border-surface-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-raised text-left text-gray-400">
            <tr>
              <th className="px-4 py-3 font-medium">Route</th>
              <th className="px-4 py-3 font-medium">Legs</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Est. settlement</th>
              <th className="px-4 py-3 font-medium">Limitations</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {ROUTES.map((r) => (
              <tr key={r.id} className="hover:bg-surface-overlay/50">
                <td className="px-4 py-3">
                  <div className="font-medium">
                    {getAsset(r.from).symbol} → {getAsset(r.to).symbol}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {r.description}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {r.legs.map((l, i) => (
                    <div key={i}>
                      {l.provider}: {getAsset(l.from).symbol}→
                      {getAsset(l.to).symbol}
                    </div>
                  ))}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={clsx(
                      "text-xs px-2 py-0.5 rounded-full font-medium",
                      r.status === "VERIFIED"
                        ? "bg-bch/15 text-bch"
                        : r.status === "PARTIALLY_VERIFIED"
                        ? "bg-amber-500/15 text-amber-400"
                        : "bg-red-500/15 text-red-400"
                    )}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400">
                  {r.estimatedSettlementSeconds
                    ? `~${Math.round(r.estimatedSettlementSeconds / 60)} min`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 max-w-xs">
                  {r.limitations[0] || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
