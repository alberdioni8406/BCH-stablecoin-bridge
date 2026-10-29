"use client";

/**
 * Phase A lab: BCH wallet adapter connect (stub or WC).
 * Not linked from main nav by default — open /labs/bch-wc
 * Does not broadcast Cauldron swaps.
 */

import { useState } from "react";
import {
  BCH_WC_ENABLED,
  WC_PROJECT_ID,
  getBchNetwork,
  BCH_CAULDRON_BROADCAST_ENABLED,
} from "@/lib/bch/config";
import { createBchWalletAdapter } from "@/lib/bch/createAdapter";
import type { BchWalletSession } from "@/lib/bch/types";
import { createCauldronBuilder } from "@/lib/bch/cauldronBuilder";
import Link from "next/link";

export default function BchWcLabPage() {
  const [session, setSession] = useState<BchWalletSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function push(msg: string) {
    setLog((l) => [`${new Date().toISOString().slice(11, 19)} ${msg}`, ...l].slice(0, 30));
  }

  async function onConnect() {
    setBusy(true);
    setError(null);
    try {
      const adapter = createBchWalletAdapter();
      push(`Using adapter: ${adapter.id}`);
      const s = await adapter.connect();
      setSession(s);
      push(`Connected: ${s.address} (${s.protocol})`);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setError(m);
      push(`Error: ${m}`);
    } finally {
      setBusy(false);
    }
  }

  async function onDisconnect() {
    const adapter = createBchWalletAdapter();
    await adapter.disconnect();
    setSession(null);
    push("Disconnected");
  }

  async function onProbeBuild() {
    setBusy(true);
    try {
      const builder = createCauldronBuilder();
      const result = await builder.buildBuyTokens({
        network: getBchNetwork(),
        tokenCategory:
          "2469acc5afa4b10cb5b5c04afb89c3a3ffd61c5da9c01e26d00951cae2a02544",
        buyTokenAmount: 1_000_000n,
        userBchAddress: session?.address || "bitcoincash:qplaceholder",
        userTokenAddress: session?.address || "bitcoincash:qplaceholder",
        slippageBps: 100,
      });
      push(
        `Build probe: implemented=${result.buildImplemented} sats=${result.totalSatsCost} prompt=${result.userPrompt}`
      );
    } catch (e) {
      push(`Build error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <Link href="/" className="text-xs text-bch hover:underline">
          ← Home
        </Link>
        <h1 className="text-2xl font-bold mt-2">Labs · BCH WalletConnect</h1>
        <p className="text-sm text-gray-400 mt-1">
          Phase A scaffold. No Cauldron mainnet broadcast. No keys stored.
        </p>
      </div>

      <div className="rounded-xl border border-surface-border bg-surface-raised p-4 text-xs font-mono space-y-1">
        <p>NEXT_PUBLIC_BCH_WC = {String(BCH_WC_ENABLED)}</p>
        <p>WC_PROJECT_ID set = {String(Boolean(WC_PROJECT_ID))}</p>
        <p>Network = {getBchNetwork()}</p>
        <p>Cauldron broadcast flag = {String(BCH_CAULDRON_BROADCAST_ENABLED)}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onConnect()}
          className="px-3 py-2 rounded-lg bg-bch text-black text-sm font-semibold disabled:opacity-40"
        >
          Connect BCH wallet
        </button>
        <button
          type="button"
          disabled={busy || !session}
          onClick={() => void onDisconnect()}
          className="px-3 py-2 rounded-lg border border-surface-border text-sm disabled:opacity-40"
        >
          Disconnect
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onProbeBuild()}
          className="px-3 py-2 rounded-lg border border-surface-border text-sm disabled:opacity-40"
        >
          Probe Cauldron builder
        </button>
      </div>

      {session && (
        <div className="text-sm font-mono break-all rounded-lg border border-bch/30 bg-bch/5 p-3">
          <p>protocol: {session.protocol}</p>
          <p>chain: {session.chainId}</p>
          <p>address: {session.address}</p>
        </div>
      )}

      {error && (
        <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
          {error}
        </p>
      )}

      <div>
        <h2 className="text-sm font-medium mb-2">Log</h2>
        <ul className="text-[11px] font-mono text-gray-500 space-y-1 max-h-48 overflow-y-auto">
          {log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </div>

      <div className="text-[11px] text-gray-500 space-y-1 border-t border-surface-border pt-4">
        <p>Next steps (Phase B):</p>
        <ol className="list-decimal list-inside space-y-0.5">
          <li>npm i @walletconnect/sign-client cashscript @mr-zwets/cauldron-swap-sdk</li>
          <li>NEXT_PUBLIC_BCH_WC=1 NEXT_PUBLIC_WC_PROJECT_ID=… NEXT_PUBLIC_BCH_NETWORK=chipnet</li>
          <li>P2PKH dust sign on chipnet via generateWcTransactionObject</li>
          <li>prepareBuyTokens + placeholder unlockers → WC sign</li>
        </ol>
      </div>
    </div>
  );
}
