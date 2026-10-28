"use client";

/**
 * THORChain EVM leg execution panel.
 * User reviews inbound/router/memo/expiry, approves USDT, then depositWithExpiry.
 * Does not auto-start Cauldron leg 2.
 */

import { useState, useCallback } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useChainId,
} from "wagmi";
import { mainnet, bsc } from "wagmi/chains";
import {
  ERC20_ABI,
  THOR_ROUTER_ABI,
  USDT_ETH,
  USDT_BSC,
} from "@/lib/wagmi/config";
import { ConnectWallet } from "./ConnectWallet";
import type { AssetId } from "@/lib/types";
import { getAsset } from "@/lib/assets/registry";
import {
  createTransferId,
  saveTransfer,
  advanceState,
  type TransferRecord,
} from "@/lib/transfer/stateMachine";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import clsx from "clsx";

interface ThorPrep {
  inboundAddress: string;
  router: string | null;
  memo: string;
  expiry: number;
  amountNative: string;
  humanAmount: string;
  expectedAmountOut: string;
  notes: string;
  depositArgs: {
    inboundAddress: string;
    asset: string;
    amount: string;
    memo: string;
    expiry: number;
  } | null;
}

interface Props {
  fromAsset: AssetId;
  /** Intermediate destination is always BCH for multi-leg */
  toAsset: AssetId;
  amount: string;
  /** User's BCH address for THOR outbound */
  bchDestination: string;
  onBchDestinationChange: (v: string) => void;
  /** Optional: notify parent of transfer id */
  onTransferCreated?: (id: string) => void;
}

export function ThorExecute({
  fromAsset,
  toAsset,
  amount,
  bchDestination,
  onBchDestinationChange,
  onTransferCreated,
}: Props) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [prep, setPrep] = useState<ThorPrep | null>(null);
  const [prepError, setPrepError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [step, setStep] = useState<
    "idle" | "prepared" | "approving" | "depositing" | "done"
  >("idle");
  const [transferId, setTransferId] = useState<string | null>(null);

  const fromMeta = getAsset(fromAsset);
  const preferredChain =
    fromMeta.network === "bsc" ? bsc.id : mainnet.id;
  const tokenAddress =
    fromMeta.network === "bsc" ? USDT_BSC : USDT_ETH;

  const routerAddress = (prep?.router ?? undefined) as
    | `0x${string}`
    | undefined;

  const { data: allowance } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args:
      address && routerAddress
        ? [address, routerAddress]
        : undefined,
    query: { enabled: Boolean(address && routerAddress && prep) },
  });

  const { data: balance } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const {
    writeContractAsync,
    data: txHash,
    error: writeError,
    isPending: isWriting,
    reset: resetWrite,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  const needsApprove =
    prep &&
    allowance !== undefined &&
    BigInt(prep.amountNative) > (allowance as bigint);

  const prepare = useCallback(async () => {
    setPreparing(true);
    setPrepError(null);
    setPrep(null);
    setStep("idle");
    resetWrite();
    try {
      if (!bchDestination || bchDestination.length < 15) {
        throw new Error(
          "Enter your BCH destination address (bitcoincash:… or legacy)."
        );
      }
      // THOR outbound for multi-leg first leg is always BCH
      const thorTo: AssetId =
        toAsset === "bch-native" ? "bch-native" : "bch-native";

      const res = await fetch("/api/thor/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromAsset,
          to: thorTo,
          amount,
          destination: bchDestination,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Prepare failed");
      const p = data.preparation as ThorPrep;
      if (!p?.inboundAddress || !p.router) {
        throw new Error("Incomplete THOR preparation response");
      }
      if (p.expiry < Math.floor(Date.now() / 1000)) {
        throw new Error("Quote already expired — prepare again");
      }
      setPrep(p);
      setStep("prepared");

      const id = createTransferId();
      const rec: TransferRecord = {
        id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        state: "QUOTED",
        from: fromAsset,
        to: toAsset,
        inputAmount: amount,
        destinationBch: bchDestination,
        legs: [
          {
            index: 0,
            provider: "thorchain",
            from: fromAsset,
            to: "bch-native",
            status: "pending",
          },
          ...(toAsset !== "bch-native"
            ? [
                {
                  index: 1 as const,
                  provider: "cauldron" as const,
                  from: "bch-native" as AssetId,
                  to: toAsset,
                  status: "pending" as const,
                },
              ]
            : []),
        ],
        intermediateAsset: "bch-native",
      };
      saveTransfer(rec);
      setTransferId(id);
      onTransferCreated?.(id);
    } catch (e) {
      setPrepError(e instanceof Error ? e.message : String(e));
    } finally {
      setPreparing(false);
    }
  }, [
    amount,
    bchDestination,
    fromAsset,
    toAsset,
    onTransferCreated,
    resetWrite,
  ]);

  const runApprove = async () => {
    if (!prep?.router || !address) return;
    setStep("approving");
    try {
      await writeContractAsync({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [prep.router as `0x${string}`, BigInt(prep.amountNative)],
        chainId: preferredChain,
      });
    } catch {
      setStep("prepared");
    }
  };

  const runDeposit = async () => {
    if (!prep?.depositArgs || !prep.router) return;
    setStep("depositing");
    try {
      const hash = await writeContractAsync({
        address: prep.router as `0x${string}`,
        abi: THOR_ROUTER_ABI,
        functionName: "depositWithExpiry",
        args: [
          prep.depositArgs.inboundAddress as `0x${string}`,
          prep.depositArgs.asset as `0x${string}`,
          BigInt(prep.depositArgs.amount),
          prep.depositArgs.memo,
          BigInt(prep.depositArgs.expiry),
        ],
        chainId: preferredChain,
      });
      if (transferId) {
        const rec = {
          id: transferId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          state: "SOURCE_BROADCAST" as const,
          from: fromAsset,
          to: toAsset,
          inputAmount: amount,
          destinationBch: bchDestination,
          legs: [
            {
              index: 0,
              provider: "thorchain" as const,
              from: fromAsset,
              to: "bch-native" as AssetId,
              status: "broadcast" as const,
              txHash: hash,
            },
          ],
          intermediateAsset: "bch-native" as AssetId,
        };
        advanceState(rec, "SOURCE_BROADCAST", {
          legs: rec.legs,
        });
      }
      setStep("done");
    } catch {
      setStep("prepared");
    }
  };

  const wrongChain = isConnected && chainId !== preferredChain;
  const amountOk =
    balance !== undefined &&
    prep &&
    (balance as bigint) >= BigInt(prep.amountNative);

  return (
    <div className="mt-6 rounded-xl border border-surface-border bg-surface-raised p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold">
          Execute leg 1 — THORChain (EVM → BCH)
        </h3>
        <ConnectWallet preferredChainId={preferredChain} />
      </div>

      <p className="text-[11px] text-gray-500">
        Non-custodial. You approve and sign in your own wallet. Leg 2 (BCH →
        PUSD/MUSD) is <strong className="text-gray-400">not</strong> started
        automatically — verify BCH arrival, then swap on Cauldron with a
        CashTokens wallet.
      </p>

      <div>
        <label className="text-xs text-gray-500">
          Your BCH destination address (THOR outbound)
        </label>
        <input
          type="text"
          value={bchDestination}
          onChange={(e) => onBchDestinationChange(e.target.value.trim())}
          placeholder="bitcoincash:q…"
          className="mt-1 w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm font-mono"
        />
      </div>

      <button
        type="button"
        onClick={prepare}
        disabled={preparing || !amount}
        className="w-full py-2.5 rounded-lg bg-surface-overlay border border-surface-border text-sm font-medium hover:border-bch/40 disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {preparing ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Preparing THOR
            params…
          </>
        ) : (
          "Prepare fresh THOR deposit"
        )}
      </button>

      {prepError && (
        <div className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          {prepError}
        </div>
      )}

      {prep && (
        <div className="text-xs space-y-2 font-mono bg-surface-overlay rounded-lg p-3 border border-surface-border">
          <Row label="Inbound" value={prep.inboundAddress} />
          <Row label="Router" value={prep.router ?? "—"} />
          <Row label="Amount (native)" value={prep.amountNative} />
          <Row label="Memo" value={prep.memo} />
          <Row
            label="Expiry"
            value={new Date(prep.expiry * 1000).toLocaleString()}
          />
          <Row
            label="Expected BCH out (est.)"
            value={
              // THOR 1e8 → human
              (Number(prep.expectedAmountOut) / 1e8).toFixed(8)
            }
          />
          {balance !== undefined && (
            <Row
              label="Your USDT balance (raw)"
              value={String(balance)}
              warn={!amountOk}
            />
          )}
          {allowance !== undefined && (
            <Row
              label="Allowance"
              value={String(allowance)}
              warn={Boolean(needsApprove)}
            />
          )}
        </div>
      )}

      {prep && isConnected && !wrongChain && (
        <div className="flex flex-col gap-2">
          {needsApprove && step !== "done" && (
            <button
              type="button"
              onClick={runApprove}
              disabled={isWriting || isConfirming || !amountOk}
              className="w-full py-2.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-100 text-sm font-medium disabled:opacity-40"
            >
              {isWriting && step === "approving"
                ? "Confirm approve in wallet…"
                : "1. Approve USDT for THOR router"}
            </button>
          )}
          <button
            type="button"
            onClick={runDeposit}
            disabled={
              isWriting ||
              isConfirming ||
              !amountOk ||
              Boolean(needsApprove) ||
              step === "done"
            }
            className="w-full py-2.5 rounded-lg bg-bch text-black text-sm font-semibold disabled:opacity-40"
          >
            {isWriting && step === "depositing"
              ? "Confirm deposit in wallet…"
              : isConfirming
                ? "Waiting for confirmation…"
                : step === "done"
                  ? "Deposit submitted"
                  : "2. Deposit via depositWithExpiry"}
          </button>
        </div>
      )}

      {writeError && (
        <p className="text-xs text-amber-400">
          {writeError.message.slice(0, 200)}
        </p>
      )}

      {(txHash || isConfirmed) && (
        <div
          className={clsx(
            "text-sm rounded-lg p-3 border flex gap-2",
            isConfirmed
              ? "bg-bch/10 border-bch/30 text-bch"
              : "bg-surface-overlay border-surface-border text-gray-300"
          )}
        >
          {isConfirmed ? <CheckCircle2 size={16} /> : <Loader2 size={16} className="animate-spin" />}
          <div>
            <p>
              {isConfirmed
                ? "Source tx confirmed on EVM."
                : "Source tx submitted…"}
            </p>
            {txHash && (
              <a
                href={
                  preferredChain === bsc.id
                    ? `https://bscscan.com/tx/${txHash}`
                    : `https://etherscan.io/tx/${txHash}`
                }
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs underline"
              >
                {txHash.slice(0, 14)}…
              </a>
            )}
            <p className="text-[11px] text-gray-400 mt-1">
              Wait for THORChain to observe and send BCH to{" "}
              <span className="font-mono">{bchDestination.slice(0, 18)}…</span>.
              Then open the Tracker and mark BCH received. Leg 2 requires a
              CashTokens BCH wallet (not connected here).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span
        className={clsx(
          "text-right break-all",
          warn ? "text-amber-300" : "text-gray-200"
        )}
      >
        {value}
      </span>
    </div>
  );
}
