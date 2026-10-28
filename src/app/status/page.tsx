import { PROVIDER_CAPABILITIES } from "@/lib/providers/capabilities";
import { ASSET_REGISTRY } from "@/lib/assets/registry";
import clsx from "clsx";

export default function StatusPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold mb-2">Provider & Asset Status</h1>
        <p className="text-gray-400">
          Technical status of integrations. No private credentials are exposed.
        </p>
      </div>
      <section>
        <h2 className="text-lg font-semibold mb-4">Providers</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {PROVIDER_CAPABILITIES.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-surface-border bg-surface-raised p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">{p.name}</h3>
                <span
                  className={clsx(
                    "text-xs px-2 py-0.5 rounded-full",
                    p.status === "VERIFIED"
                      ? "bg-bch/15 text-bch"
                      : "bg-amber-500/15 text-amber-400"
                  )}
                >
                  {p.status}
                </span>
              </div>
              <a
                href={p.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-bch hover:underline"
              >
                Official docs →
              </a>
              <ul className="mt-3 text-xs text-gray-400 space-y-1 list-disc list-inside">
                {p.limitations.slice(0, 3).map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
              <p className="mt-3 text-[10px] text-gray-600 font-mono">
                Last checked: {p.lastChecked}
              </p>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-lg font-semibold mb-4">Assets</h2>
        <div className="overflow-x-auto rounded-xl border border-surface-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-raised text-left text-gray-400">
              <tr>
                <th className="px-4 py-3">Asset</th>
                <th className="px-4 py-3">Network</th>
                <th className="px-4 py-3">Identifier</th>
                <th className="px-4 py-3">Decimals</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Enabled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {Object.values(ASSET_REGISTRY).map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 font-medium">
                    {a.symbol}
                    <span className="block text-xs text-gray-500">{a.name}</span>
                  </td>
                  <td className="px-4 py-3 uppercase text-xs">{a.network}</td>
                  <td className="px-4 py-3 font-mono text-xs max-w-[200px] truncate">
                    {a.identifier}
                  </td>
                  <td className="px-4 py-3">{a.decimals}</td>
                  <td className="px-4 py-3">
                    <span
                      className={clsx(
                        "text-xs",
                        a.verificationStatus === "VERIFIED"
                          ? "text-bch"
                          : "text-amber-400"
                      )}
                    >
                      {a.verificationStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {a.enabled ? (
                      <span className="text-bch">Yes</span>
                    ) : (
                      <span className="text-gray-500">No</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
