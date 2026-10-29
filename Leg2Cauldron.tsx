"use client";

/**
 * Leg 2 panel: fresh Cauldron quote + verification helpers.
 * Does NOT sign or broadcast CashTokens swaps in-browser.
 */

import { useState, useCallback } from "react";
import type { AssetId } from "@/lib/types";
import { getAsset } from "@/lib/assets/registry";
import {
  CAULDRON_EXECUTION,
  leg2RecoveryHint,
} from "@/lib/bch/cauldronExecution";
import { Loader2, AlertTriangle, ExternalLink } from "lucide-react";

interface Props {
  toAsset: AssetId;
  bchDestination: string;
  /** Optional estimated BCH from THOR leg (do not treat as spendable) */
  estimatedBch?: string;
}

export function Leg2Cauldron({
  toAsset,
  bchDestination,
  estimatedBch,
}: Props) {
  const [amount, setAmount] = useState(estimatedBch || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<{
    expectedOutput?: string;
    priceImpactBps?: number;
    providerFee?: string | null;
    notes?: string;
    expiry?: number;
  } | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [balance, setBalance] = useState<{
    balanceBch?: string;
    balanceSats?: string;
    error?: string;
  } | null>(null);

  const toMeta = getAsset(toAsset);
  const isTokenDest = toAsset === "pusd" || toAsset === "musd";

  const fetchQuote = useCallback(async () => {
    if (!isTokenDest) return;
    setLoading(true);
    setError(null);
    setQuote(null);
    try {
      if (!amount || Number(amount) <= 0) {
        throw new Error("Enter the actual spendable BCH amount from your wallet");
      }
      const res = await fetch("/api/cauldron/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "bch-native",
          to: toAsset,
          amount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Quote failed");
      setQuote(data.quote);
      setCategoryId(data.categoryId ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [amount, isTokenDest, toAsset]);

  const checkBalance = useCallback(async () => {
    if (!bchDestination) {
      setBalance({ error: "Enter BCH destination first" });
      return;
    }
    try {
      const res = await fetch(
        `/api/bch/balance?address=${encodeURIComponent(bchDestination)}`
      );
      const data = await res.json();
      if (!res.ok) setBalance({ error: data.error || "Failed" });
      else {
        setBalance({
          balanceBch: data.balanceBch,
          balanceSats: data.balanceSats,
        });
        if (data.balanceBch) setAmount(data.balanceBch);
      }
    } catch (e) {
      setBalance({
        error: e instanceof Error ? e.message : "Balance failed",
      });
    }
  }, [bchDestination]);

  if (!isTokenDest) return null;

  return (
    <div className="mt-6 rounded-xl border border-surface-border bg-surface-raised p-4 space-y-4">
      <h3 className="text-sm font-semibold">
        Leg 2 — Cauldron (BCH → {toMeta.symbol})
      </h3>
      <p className="text-[11px] text-gray-500">
        Browser signing is <strong className="text-gray-300">not</strong> enabled
        ({CAULDRON_EXECUTION.browserSigningReady ? "ready" : "blocked"}). Get a
        fresh estimate, then execute in a CashTokens wallet (Paytaca recommended).
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void checkBalance()}
          className="text-xs px-2 py-1.5 rounded border border-surface-border text-gray-300"
        >
          Check BCH balance (explorer)
        </button>
        {balance?.balanceBch && (
          <span className="text-xs font-mono text-bch self-center">
            ≈ {balance.balanceBch} BCH
          </span>
        )}
        {balance?.error && (
          <span className="text-xs text-amber-300">{balance.error}</span>
        )}
      </div>

      <div>
        <label className="text-xs text-gray-500">
          Spendable BCH amount (from your wallet, not the THOR estimate alone)
        </label>
        <input
          type="text"
          value={amount}
          onChange={(e) => setAmount(e.target.value.trim())}
          className="mt-1 w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm font-mono"
          placeholder="0.01"
        />
      </div>

      <button
        type="button"
        onClick={() => void fetchQuote()}
        disabled={loading || !amount}
        className="w-full py-2.5 rounded-lg bg-surface-overlay border border-surface-border text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Quoting…
          </>
        ) : (
          "Fresh Cauldron estimate"
        )}
      </button>

      {error && (
        <div className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {quote && (
        <div className="text-xs space-y-1 font-mono bg-surface-overlay rounded-lg p-3 border border-surface-border">
          <div className="flex justify-between">
            <span className="text-gray-500">Est. {toMeta.symbol}</span>
            <span>{quote.expectedOutput}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Impact (bps)</span>
            <span>{quote.priceImpactBps ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Fee</span>
            <span>{quote.providerFee ?? "0.3% LP"}</span>
          </div>
          {categoryId && (
            <div className="pt-2 break-all">
              <span className="text-gray-500">Category ID: </span>
              <span className="text-bch">{categoryId}</span>
            </div>
          )}
          {quote.notes && (
            <p className="text-gray-500 pt-1 whitespace-pre-wrap">{quote.notes}</p>
          )}
        </div>
      )}

      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-amber-100/90 space-y-2">
        <p>{leg2RecoveryHint(bchDestination || "(set BCH address above)", amount)}</p>
        <a
          href="https://www.paytaca.com/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-bch hover:underline"
        >
          Open Paytaca <ExternalLink size={12} />
        </a>
        <p className="text-gray-500">
          After the swap, use Tracker → paste Cauldron txid → mark complete only
          when {toMeta.symbol} is visible in your wallet.
        </p>
      </div>
    </div>
  );
}
