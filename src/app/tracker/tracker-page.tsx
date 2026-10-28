"use client";

import { useEffect, useState, useCallback } from "react";
import {
  loadTransfers,
  type TransferRecord,
  type TransferState,
  advanceState,
  createTransferId,
  saveTransfer,
} from "@/lib/transfer/stateMachine";
import { getAsset } from "@/lib/assets/registry";
import clsx from "clsx";

const STATE_ORDER: TransferState[] = [
  "DRAFT",
  "QUOTED",
  "AWAITING_SOURCE_SIGNATURE",
  "SOURCE_BROADCAST",
  "SOURCE_CONFIRMED",
  "AWAITING_INTERMEDIATE",
  "INTERMEDIATE_RECEIVED",
  "AWAITING_DEST_QUOTE",
  "DEST_QUOTED",
  "AWAITING_DEST_SIGNATURE",
  "DEST_BROADCAST",
  "DEST_CONFIRMED",
  "COMPLETED",
];

export default function TrackerPage() {
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [selected, setSelected] = useState<TransferRecord | null>(null);
  const [balanceInfo, setBalanceInfo] = useState<{
    balanceSats?: string;
    balanceBch?: string;
    txCount?: number;
    error?: string;
    notes?: string;
  } | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [leg2Txid, setLeg2Txid] = useState("");

  const refresh = useCallback(() => {
    setTransfers(loadTransfers());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function createDemoMultiLeg() {
    const id = createTransferId();
    const rec: TransferRecord = {
      id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      state: "QUOTED",
      from: "eth-usdt",
      to: "pusd",
      inputAmount: "50",
      destinationBch: "",
      legs: [
        {
          index: 0,
          provider: "thorchain",
          from: "eth-usdt",
          to: "bch-native",
          status: "pending",
        },
        {
          index: 1,
          provider: "cauldron",
          from: "bch-native",
          to: "pusd",
          status: "pending",
        },
      ],
      intermediateAsset: "bch-native",
    };
    saveTransfer(rec);
    refresh();
    setSelected(rec);
  }

  function setState(next: TransferState) {
    if (!selected) return;
    const updated = advanceState(selected, next, {
      intermediateAmount:
        next === "INTERMEDIATE_RECEIVED"
          ? selected.intermediateAmount || "(user-verified)"
          : selected.intermediateAmount,
      recoveryHint:
        next === "RECOVERY_REQUIRED"
          ? "First leg may have completed. Check your BCH wallet for intermediate funds. Start a new BCH → PUSD swap when ready. Do not re-send the ETH source tx."
          : selected.recoveryHint,
    });
    setSelected(updated);
    refresh();
  }


  async function verifyBchBalance() {
    if (!selected?.destinationBch) {
      setBalanceInfo({ error: "No BCH destination on this transfer" });
      return;
    }
    setBalanceLoading(true);
    setBalanceInfo(null);
    try {
      const res = await fetch(
        `/api/bch/balance?address=${encodeURIComponent(selected.destinationBch)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setBalanceInfo({ error: data.error || "Balance lookup failed" });
      } else {
        setBalanceInfo({
          balanceSats: data.balanceSats,
          balanceBch: data.balanceBch,
          txCount: data.txCount,
          notes: data.notes,
        });
      }
    } catch (e) {
      setBalanceInfo({
        error: e instanceof Error ? e.message : "Balance lookup failed",
      });
    } finally {
      setBalanceLoading(false);
    }
  }

  function markIntermediateFromExplorer() {
    if (!selected || !balanceInfo?.balanceSats) return;
    const updated = advanceState(selected, "INTERMEDIATE_RECEIVED", {
      intermediateAmount: balanceInfo.balanceBch || balanceInfo.balanceSats,
      recoveryHint:
        "Explorer balance is a hint only. Confirm spendable BCH in your wallet before swapping to PUSD.",
    });
    setSelected(updated);
    refresh();
  }

  function markLeg2ManualComplete() {
    if (!selected) return;
    const tx = leg2Txid.trim();
    if (tx.length < 16) {
      alert("Paste the BCH/Cauldron txid from your wallet after the PUSD swap.");
      return;
    }
    const legs = selected.legs.map((l, i) =>
      i === 1 ? { ...l, status: "confirmed" as const, txHash: tx } : l
    );
    const updated = advanceState(selected, "COMPLETED", {
      legs,
      recoveryHint: undefined,
      error: undefined,
    });
    setSelected(updated);
    refresh();
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Transaction Tracker</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Multi-leg transfers are sequential and non-atomic. State is stored in
          your browser only — never on our servers.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={createDemoMultiLeg}
          className="text-sm px-3 py-1.5 rounded-lg border border-surface-border hover:border-bch/50 text-gray-300"
        >
          New multi-leg draft (ETH USDT → PUSD)
        </button>
        <button
          type="button"
          onClick={refresh}
          className="text-sm px-3 py-1.5 rounded-lg border border-surface-border text-gray-400"
        >
          Refresh
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-surface-border bg-surface-raised p-4 space-y-2 max-h-80 overflow-y-auto">
          <h2 className="text-sm font-medium text-gray-400 mb-2">History</h2>
          {transfers.length === 0 && (
            <p className="text-sm text-gray-500">No transfers yet.</p>
          )}
          {transfers.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelected(t)}
              className={clsx(
                "w-full text-left text-sm p-2 rounded-lg border transition",
                selected?.id === t.id
                  ? "border-bch/50 bg-bch/5"
                  : "border-transparent hover:bg-surface-overlay"
              )}
            >
              <div className="font-mono text-xs text-gray-500">{t.id}</div>
              <div>
                {getAsset(t.from).symbol} → {getAsset(t.to).symbol} ·{" "}
                {t.inputAmount}
              </div>
              <div
                className={clsx(
                  "text-xs mt-0.5",
                  t.state === "COMPLETED"
                    ? "text-bch"
                    : t.state === "RECOVERY_REQUIRED" || t.state === "FAILED"
                      ? "text-amber-400"
                      : "text-gray-400"
                )}
              >
                {t.state}
              </div>
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
          {!selected ? (
            <p className="text-sm text-gray-500">Select a transfer</p>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="text-xs text-gray-500 font-mono">{selected.id}</div>
                <div className="text-lg font-medium">
                  {getAsset(selected.from).symbol} →{" "}
                  {getAsset(selected.to).symbol}
                </div>
                <div className="text-sm text-gray-400">
                  Amount: {selected.inputAmount}
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-1">State machine</div>
                <div className="flex flex-wrap gap-1">
                  {STATE_ORDER.map((s) => (
                    <span
                      key={s}
                      className={clsx(
                        "text-[10px] px-1.5 py-0.5 rounded font-mono",
                        selected.state === s
                          ? "bg-bch/20 text-bch"
                          : "bg-surface-overlay text-gray-600"
                      )}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-1 text-sm">
                {selected.legs.map((leg) => (
                  <div
                    key={leg.index}
                    className="flex justify-between border-b border-surface-border py-1"
                  >
                    <span>
                      Leg {leg.index + 1}: {getAsset(leg.from).symbol} →{" "}
                      {getAsset(leg.to).symbol}
                    </span>
                    <span className="text-gray-400 font-mono text-xs">
                      {leg.provider} · {leg.status}
                      {leg.txHash ? ` · ${leg.txHash.slice(0, 10)}…` : ""}
                    </span>
                  </div>
                ))}
              </div>

              
              <div className="mt-4 p-3 rounded-lg border border-surface-border space-y-2">
                <p className="text-xs font-medium text-gray-300">
                  Verify intermediate BCH (explorer)
                </p>
                <button
                  type="button"
                  disabled={balanceLoading || !selected.destinationBch}
                  onClick={() => void verifyBchBalance()}
                  className="text-xs px-2 py-1 rounded border border-bch/40 text-bch disabled:opacity-40"
                >
                  {balanceLoading ? "Checking…" : "Fetch address balance"}
                </button>
                {balanceInfo?.error && (
                  <p className="text-xs text-amber-300">{balanceInfo.error}</p>
                )}
                {balanceInfo?.balanceBch && (
                  <div className="text-xs font-mono text-gray-300 space-y-1">
                    <p>Balance ≈ {balanceInfo.balanceBch} BCH ({balanceInfo.balanceSats} sats)</p>
                    <p>Tx count: {balanceInfo.txCount}</p>
                    <p className="text-gray-500">{balanceInfo.notes}</p>
                    <button
                      type="button"
                      onClick={markIntermediateFromExplorer}
                      className="text-xs px-2 py-1 rounded border border-surface-border"
                    >
                      Mark intermediate received (user-confirmed)
                    </button>
                  </div>
                )}
                <div className="pt-2 border-t border-surface-border">
                  <label className="text-[11px] text-gray-500">
                    Leg 2 Cauldron/Paytaca txid (manual)
                  </label>
                  <input
                    value={leg2Txid}
                    onChange={(e) => setLeg2Txid(e.target.value.trim())}
                    placeholder="BCH transaction id after PUSD swap"
                    className="mt-1 w-full bg-surface border border-surface-border rounded px-2 py-1 text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={markLeg2ManualComplete}
                    className="mt-2 text-xs px-2 py-1 rounded border border-bch/40 text-bch"
                  >
                    Mark complete after verifying PUSD in wallet
                  </button>
                </div>
              </div>

{selected.recoveryHint && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm text-amber-200">
                  <strong>Recovery:</strong> {selected.recoveryHint}
                </div>
              )}

              {selected.state === "COMPLETED" && (
                <div className="p-3 rounded-lg bg-bch/10 border border-bch/30 text-sm text-bch">
                  Destination verified. Transfer complete.
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  className="text-xs px-2 py-1 rounded border border-surface-border"
                  onClick={() => setState("AWAITING_SOURCE_SIGNATURE")}
                >
                  Start leg 1
                </button>
                <button
                  type="button"
                  className="text-xs px-2 py-1 rounded border border-surface-border"
                  onClick={() => setState("SOURCE_CONFIRMED")}
                >
                  Source confirmed
                </button>
                <button
                  type="button"
                  className="text-xs px-2 py-1 rounded border border-surface-border"
                  onClick={() => setState("INTERMEDIATE_RECEIVED")}
                >
                  BCH received
                </button>
                <button
                  type="button"
                  className="text-xs px-2 py-1 rounded border border-surface-border"
                  onClick={() => setState("DEST_QUOTED")}
                >
                  Leg 2 quoted
                </button>
                <button
                  type="button"
                  className="text-xs px-2 py-1 rounded border border-surface-border"
                  onClick={() => setState("COMPLETED")}
                >
                  Complete
                </button>
                <button
                  type="button"
                  className="text-xs px-2 py-1 rounded border border-amber-500/40 text-amber-300"
                  onClick={() => setState("RECOVERY_REQUIRED")}
                >
                  Recovery
                </button>
              </div>
              <p className="text-[11px] text-gray-500">
                Buttons advance local state for UX testing. Real execution
                requires wallet signatures and on-chain verification.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
