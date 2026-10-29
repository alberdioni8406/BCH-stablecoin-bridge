"use client";

import { useState, useCallback } from "react";
import { getEnabledAssets, getAsset } from "@/lib/assets/registry";
import type { AssetId, NormalizedQuote } from "@/lib/types";
import { findRoutes } from "@/lib/routing/routes";
import { ArrowDownUp, AlertTriangle, Loader2 } from "lucide-react";
import { ThorExecute } from "./ThorExecute";
import { Leg2Cauldron } from "./Leg2Cauldron";
import clsx from "clsx";

const assets = getEnabledAssets();

export function SwapInterface() {
  const [fromId, setFromId] = useState<AssetId>("eth-usdt");
  const [toId, setToId] = useState<AssetId>("pusd");
  const [amount, setAmount] = useState("10");
  const [quote, setQuote] = useState<NormalizedQuote | null>(null);
  const [multiLegNote, setMultiLegNote] = useState<string | null>(null);
  const [finalAmount, setFinalAmount] = useState<string | null>(null);
  const [intermediateAmount, setIntermediateAmount] = useState<string | null>(null);
  const [intermediateAsset, setIntermediateAsset] = useState<string | null>(null);
  const [leg2Error, setLeg2Error] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<ReturnType<typeof findRoutes>[0] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<string>("");
  const [bchDestination, setBchDestination] = useState("");

  const routes = findRoutes(fromId, toId);

  const fetchQuote = useCallback(async () => {
    setLoading(true);
    setError(null);
    setQuote(null);
    setMultiLegNote(null);
    setFinalAmount(null);
    setIntermediateAmount(null);
    setIntermediateAsset(null);
    setLeg2Error(null);
    try {
      const res = await fetch(
        `/api/quote?from=${fromId}&to=${toId}&amount=${encodeURIComponent(amount)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Quote failed");
        return;
      }
      setMode(data.mode);
      setRouteInfo(data.route);
      if (data.multiLeg) {
        setMultiLegNote(data.notes || "Multi-leg route — not atomic.");
        setIntermediateAmount(data.intermediateAmount ?? null);
        setIntermediateAsset(data.intermediateAsset ?? null);
        setLeg2Error(data.leg2Error ?? null);
        setFinalAmount(data.finalAmount ?? null);
        // Display final destination quote when available; never show BCH as final for multi-leg
        if (data.finalQuote) {
          setQuote(data.finalQuote);
        } else if (data.quotes?.[0]) {
          // leg1 only — do not treat as final
          setQuote(null);
          setError(
            data.leg2Error
              ? `Second leg unavailable: ${data.leg2Error}. Intermediate estimate: ${data.intermediateAmount ?? "?"} BCH — not the final token amount.`
              : "Second leg quote unavailable. Intermediate BCH is not the destination amount."
          );
        }
      } else {
        setMultiLegNote(null);
        setIntermediateAmount(null);
        setIntermediateAsset(null);
        setLeg2Error(null);
        setFinalAmount(data.finalAmount ?? data.quotes?.[0]?.expectedOutput ?? null);
        if (data.quotes?.[0]) setQuote(data.quotes[0]);
      }
      if (data.warning) setError(data.warning);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [fromId, toId, amount]);

  const swapDirection = () => {
    setFromId(toId);
    setToId(fromId);
    setQuote(null);
  };

  const fromAsset = getAsset(fromId);
  const toAsset = getAsset(toId);

  return (
    <div className="max-w-lg mx-auto">
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Swap</h1>
          <span
            className={clsx(
              "text-xs px-2 py-0.5 rounded-full font-mono",
              mode === "live"
                ? "bg-bch/20 text-bch"
                : "bg-amber-500/20 text-amber-400"
            )}
          >
            {mode || "—"}
          </span>
        </div>

        {/* From */}
        <div className="rounded-xl bg-surface-overlay border border-surface-border p-4 mb-1">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>You pay</span>
            <span>{fromAsset.network.toUpperCase()}</span>
          </div>
          <div className="flex gap-3 items-center">
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              className="flex-1 bg-transparent text-2xl font-medium outline-none placeholder:text-gray-600"
              placeholder="0.0"
            />
            <select
              value={fromId}
              onChange={(e) => {
                setFromId(e.target.value as AssetId);
                setQuote(null);
              }}
              className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-bch"
            >
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.symbol} ({a.network})
                </option>
              ))}
            </select>
          </div>
          <p className="mt-2 text-[11px] text-gray-500 font-mono truncate">
            {fromAsset.identifier === "native"
              ? "Native BCH"
              : fromAsset.identifier}
          </p>
        </div>

        <div className="flex justify-center -my-2 relative z-10">
          <button
            type="button"
            onClick={swapDirection}
            className="w-9 h-9 rounded-full bg-surface border border-surface-border flex items-center justify-center text-gray-400 hover:text-bch hover:border-bch/50 transition"
          >
            <ArrowDownUp size={16} />
          </button>
        </div>

        {/* To */}
        <div className="rounded-xl bg-surface-overlay border border-surface-border p-4 mt-1">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>You receive (est.)</span>
            <span>{toAsset.network.toUpperCase()}</span>
          </div>
          <div className="flex gap-3 items-center">
            <div className="flex-1 text-2xl font-medium text-gray-300">
              {(finalAmount ?? quote?.expectedOutput) ?? "—"}
            </div>
            <select
              value={toId}
              onChange={(e) => {
                setToId(e.target.value as AssetId);
                setQuote(null);
              }}
              className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-bch"
            >
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.symbol} ({a.network})
                </option>
              ))}
            </select>
          </div>
          <p className="mt-2 text-[11px] text-gray-500 font-mono truncate">
            {toAsset.identifier === "native" ? "Native BCH" : toAsset.identifier}
          </p>
        </div>

        {/* Route status */}
        {routes.length === 0 ? (
          <div className="mt-4 flex items-start gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>No supported route for this pair in the allowlist.</span>
          </div>
        ) : (
          <div className="mt-4 text-xs text-gray-400 space-y-1">
            <p>
              Route:{" "}
              <span className="text-gray-200">{routes[0].description}</span>
            </p>
            <p>
              Status:{" "}
              <span
                className={clsx(
                  routes[0].status === "VERIFIED"
                    ? "text-bch"
                    : "text-amber-400"
                )}
              >
                {routes[0].status}
              </span>
            </p>
          </div>
        )}

        {quote && (
          <div className="mt-4 rounded-lg bg-surface border border-surface-border p-3 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-gray-500">Provider</span>
              <span className="font-mono uppercase">{quote.provider}</span>
            </div>
            {quote.priceImpactBps != null && (
              <div className="flex justify-between">
                <span className="text-gray-500">Price impact</span>
                <span>{(quote.priceImpactBps / 100).toFixed(2)}%</span>
              </div>
            )}
            {quote.networkFee && (
              <div className="flex justify-between">
                <span className="text-gray-500">Network fee (est.)</span>
                <span>{quote.networkFee}</span>
              </div>
            )}
            {quote.expiry && (
              <div className="flex justify-between">
                <span className="text-gray-500">Quote expiry</span>
                <span className="font-mono">
                  {new Date(quote.expiry * 1000).toLocaleTimeString()}
                </span>
              </div>
            )}
            {quote.isPrototypeSample && (
              <p className="text-amber-400 pt-1 border-t border-surface-border mt-2">
                ⚠ Prototype sample — not a live on-chain quote.
              </p>
            )}
            {quote.notes && !quote.isPrototypeSample && (
              <p className="text-gray-500 pt-1 border-t border-surface-border mt-2 line-clamp-3">
                {quote.notes}
              </p>
            )}
          </div>
        )}

        {(intermediateAmount || leg2Error) && (
          <div className="mt-3 text-xs rounded-lg border border-surface-border bg-surface-overlay p-3 space-y-1">
            <div className="flex justify-between text-gray-400">
              <span>Intermediate (est.)</span>
              <span className="font-mono text-gray-200">
                {intermediateAmount ?? "—"} {intermediateAsset === "bch-native" ? "BCH" : intermediateAsset ?? ""}
              </span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Final destination (est.)</span>
              <span className="font-mono text-bch">
                {finalAmount ?? "unavailable"} {toAsset.symbol}
              </span>
            </div>
            <p className="text-amber-400/90 pt-1">
              Non-atomic multi-leg. You may hold intermediate BCH if leg 2 fails.
            </p>
          </div>
        )}

        {multiLegNote && (
          <div className="mt-3 text-sm text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            {multiLegNote}
          </div>
        )}

        {error && (
          <div className="mt-3 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={fetchQuote}
          disabled={loading || routes.length === 0 || !amount}
          className="mt-5 w-full py-3 rounded-xl bg-bch hover:bg-bch-dark disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold transition flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Fetching quote…
            </>
          ) : (
            "Get Quote"
          )}
        </button>

        <p className="mt-3 text-[11px] text-center text-gray-500">
          Non-custodial. You sign in your own wallet. Multi-step routes are not
          atomic.
        </p>
      </div>

      {/* THOR EVM execution — only when source is EVM and first leg is thorchain */}
      {routes[0]?.legs[0]?.provider === "thorchain" &&
        (fromId === "eth-usdt" ||
          fromId === "eth-usdc" ||
          fromId === "bsc-usdt" ||
          fromId === "bsc-usdc") &&
        amount &&
        Number(amount) > 0 && (
          <ThorExecute
            fromAsset={fromId}
            toAsset={toId}
            amount={amount}
            bchDestination={bchDestination}
            onBchDestinationChange={setBchDestination}
          />
        )}

      {/* Leg 2 guidance when destination is CashToken stable */}
      {(toId === "pusd" || toId === "musd") && bchDestination && (
        <Leg2Cauldron
          toAsset={toId}
          bchDestination={bchDestination}
        />
      )}

      {routeInfo && routeInfo.legs.length > 1 && (
        <div className="mt-6 rounded-xl border border-surface-border bg-surface-raised p-4">
          <h3 className="text-sm font-medium mb-3">Route diagram</h3>
          <div className="flex flex-col gap-2">
            {routeInfo.legs.map((leg, i) => (
              <div
                key={i}
                className="flex items-center gap-3 text-sm font-mono"
              >
                <span className="text-gray-400 w-6">{i + 1}.</span>
                <span>{getAsset(leg.from).symbol}</span>
                <span className="text-gray-600">→</span>
                <span>{getAsset(leg.to).symbol}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-surface-overlay text-gray-400">
                  {leg.provider}
                </span>
                <span
                  className={clsx(
                    "text-xs ml-auto",
                    leg.status === "VERIFIED" ? "text-bch" : "text-amber-400"
                  )}
                >
                  {leg.status}
                </span>
              </div>
            ))}
          </div>
          {routeInfo.limitations.length > 0 && (
            <ul className="mt-3 text-xs text-amber-400/90 list-disc list-inside space-y-0.5">
              {routeInfo.limitations.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
