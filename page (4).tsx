"use client";
import { useState } from "react";
import type { TransferState } from "@/lib/types";

const STATES: TransferState[] = [
  "DRAFT","QUOTED","AWAITING_SIGNATURE","SUBMITTED","SOURCE_CONFIRMED",
  "PROCESSING","DESTINATION_CONFIRMED","COMPLETED","FAILED","RECOVERY_REQUIRED",
];

export default function TrackerPage() {
  const [demoState, setDemoState] = useState<TransferState>("DRAFT");
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">Transaction Tracker</h1>
      <p className="text-gray-400 mb-8">
        Multi-step transfers are non-atomic. Live monitoring requires a submitted source transaction hash.
      </p>
      <div className="rounded-xl border border-surface-border bg-surface-raised p-5">
        <p className="text-sm text-amber-400 mb-4">
          Prototype mode: no live transfers are stored. Select a state to preview the UI.
        </p>
        <label className="text-xs text-gray-500">Demo transfer state</label>
        <select
          value={demoState}
          onChange={(e) => setDemoState(e.target.value as TransferState)}
          className="mt-1 w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm"
        >
          {STATES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <div className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Current state</span>
            <span className="font-mono text-bch">{demoState}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Source tx</span>
            <span className="font-mono text-gray-400">—</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Destination tx</span>
            <span className="font-mono text-gray-400">—</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Intermediate asset</span>
            <span className="text-gray-400">BCH (when multi-leg)</span>
          </div>
        </div>
        {demoState === "RECOVERY_REQUIRED" && (
          <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm text-amber-200">
            <strong>Recovery required.</strong> The first leg may have completed while a later leg failed.
            Check your wallet for the intermediate asset (usually BCH) and either retry the second leg
            manually or hold the asset. Never re-send the source transaction without verifying the previous outcome.
          </div>
        )}
        {demoState === "COMPLETED" && (
          <div className="mt-4 p-3 rounded-lg bg-bch/10 border border-bch/30 text-sm text-bch">
            Destination transaction independently verified. Transfer complete.
          </div>
        )}
      </div>
    </div>
  );
}
