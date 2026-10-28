"use client";

/**
 * THORChain EVM leg-1 execution panel.
 * Prepare → Approve USDT → depositWithExpiry. No Cauldron auto-start.
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
  erc20Abi,
  thorRouterAbi,
  USDT_ETH,
  USDT_BSC,
} from "@/lib/wagmi/config";
import { ConnectWallet } from "./ConnectWallet";
import type { AssetId } from "@/lib/types";
import { getAsset } from "@/lib/assets/registry";
import {
  createTransferId,
  saveTransfer,
  type TransferRecord,
} from "@/lib/transfer/stateMachine";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import clsx from "clsx";

interface ThorPrep {
  inboundAddress: string;
  router: string;
  memo: string;
  expiry: number;
  amountNative: string;
  expectedAmountOut: string;
  depositArgs: {
    inboundAddress: string;
    asset: string;
    amount: string;
    memo: string;
    expiry: number;
  };
}

interface Props {
  fromAsset: AssetId;
  toAsset: AssetId;
  amount: string;
  bchDestination: string;
  onBchDestinationChange: (v: string) => void;
}

export function ThorExecute({
  fromAsset,
  toAsset,
  amount,
  bchDestination,
  onBchDestinationChange,
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
  const [localTxHash, setLocalTxHash] = useState<`0x${string}` | undefined>();

  const fromMeta = getAsset(fromAsset);
  const preferredChain = fromMeta.network === "bsc" ? bsc.id : mainnet.id;
  const tokenAddress = fromMeta.network === "bsc" ? USDT_BSC : USDT_ETH;

  const routerAddr = prep?.router as `0x${string}` | undefined;

  const { data: allowance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && routerAddr ? [address, routerAddr] : undefined,
    query: { enabled: Boolean(address && routerAddr) },
  });

  const { data: balance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const {
    writeContractAsync,
    error: writeError,
    isPending: isWriting,
    reset: resetWrite,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: localTxHash });

  const needsApprove =
    prep != null &&
    allowance !== undefined &&
    BigInt(prep.amountNative) > BigInt(allowance as bigint);

  const amountOk =
    balance !== undefined &&
    prep != null &&
    BigInt(balance as bigint) >= BigInt(prep.amountNative);

  const prepare = useCallback(async () => {
    setPreparing(true);
    setPrepError(null);
    setPrep(null);
    setStep("idle");
    setLocalTxHash(undefined);
    resetWrite();
    try {
      if (!bchDestination || bchDestination.length < 15) {
        throw new Error("Enter your BCH destination address (bitcoincash:…).");
      }
      const res = await fetch("/api/thor/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromAsset,
          to: "bch-native",
          amount,
          destination: bchDestination,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        preparation?: {
          inboundAddress?: string;
          router?: string | null;
          memo?: string;
          expiry?: number;
          amountNative?: string;
          expectedAmountOut?: string;
          depositArgs?: ThorPrep["depositArgs"] | null;
        };
      };
      if (!res.ok) throw new Error(data.error || "Prepare failed");
      const p = data.preparation;
      if (
        !p?.inboundAddress ||
        !p.router ||
        !p.depositArgs ||
        !p.memo ||
        !p.amountNative
      ) {
        throw new Error("Incomplete THOR preparation response");
      }
      if ((p.expiry ?? 0) < Math.floor(Date.now() / 1000)) {
        throw new Error("Quote already expired — prepare again");
      }
      const normalized: ThorPrep = {
        inboundAddress: p.inboundAddress,
        router: p.router,
        memo: p.memo,
        expiry: p.expiry ?? Math.floor(Date.now() / 1000) + 600,
        amountNative: p.amountNative,
        expectedAmountOut: p.expectedAmountOut ?? "0",
        depositArgs: p.depositArgs,
      };
      setPrep(normalized);
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
        ],
        intermediateAsset: "bch-native",
      };
      if (toAsset !== "bch-native") {
        rec.legs.push({
          index: 1,
          provider: "cauldron",
          from: "bch-native",
          to: toAsset,
          status: "pending",
        });
      }
      saveTransfer(rec);
      setTransferId(id);
    } catch (e) {
      setPrepError(e instanceof Error ? e.message : String(e));
    } finally {
      setPreparing(false);
    }
  }, [amount, bchDestination, fromAsset, toAsset, resetWrite]);

  const runApprove = async () => {
    if (!prep || !address) return;
    setStep("approving");
    try {
      await writeContractAsync({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [prep.router as `0x${string}`, BigInt(prep.amountNative)],
      });
      setStep("prepared");
    } catch {
      setStep("prepared");
    }
  };

  const runDeposit = async () => {
    if (!prep) return;
    setStep("depositing");
    try {
      const hash = await writeContractAsync({
        address: prep.router as `0x${string}`,
        abi: thorRouterAbi,
        functionName: "depositWithExpiry",
        args: [
          prep.depositArgs.inboundAddress as `0x${string}`,
          prep.depositArgs.asset as `0x${string}`,
          BigInt(prep.depositArgs.amount),
          prep.depositArgs.memo,
          BigInt(prep.depositArgs.expiry),
        ],
      });
      setLocalTxHash(hash);
      if (transferId) {
        const rec: TransferRecord = {
          id: transferId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          state: "SOURCE_BROADCAST",
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
              status: "broadcast",
              txHash: hash,
            },
          ],
          intermediateAsset: "bch-native",
        };
        saveTransfer(rec);
      }
      setStep("done");
    } catch {
      setStep("prepared");
    }
  };

  const wrongChain = isConnected && chainId !== preferredChain;

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
        automatically.
      </p>

      <div>
        <label className="text-xs text-gray-500">Your BCH destination address</label>
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
            <Loader2 size={16} className="animate-spin" /> Preparing…
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
          <Row label="Router" value={prep.router} />
          <Row label="Amount (native)" value={prep.amountNative} />
          <Row label="Memo" value={prep.memo} />
          <Row label="Expiry" value={new Date(prep.expiry * 1000).toLocaleString()} />
          <Row
            label="Expected BCH (est.)"
            value={(Number(prep.expectedAmountOut) / 1e8).toFixed(8)}
          />
          {balance !== undefined && (
            <Row label="USDT balance (raw)" value={String(balance)} warn={!amountOk} />
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
        <p className="text-xs text-amber-400">{writeError.message.slice(0, 240)}</p>
      )}

      {(localTxHash || isConfirmed) && (
        <div
          className={clsx(
            "text-sm rounded-lg p-3 border flex gap-2",
            isConfirmed
              ? "bg-bch/10 border-bch/30 text-bch"
              : "bg-surface-overlay border-surface-border text-gray-300"
          )}
        >
          {isConfirmed ? (
            <CheckCircle2 size={16} />
          ) : (
            <Loader2 size={16} className="animate-spin" />
          )}
          <div>
            <p>
              {isConfirmed
                ? "Source tx confirmed on EVM."
                : "Source tx submitted…"}
            </p>
            {localTxHash && (
              <a
                href={
                  preferredChain === bsc.id
                    ? `https://bscscan.com/tx/${localTxHash}`
                    : `https://etherscan.io/tx/${localTxHash}`
                }
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs underline"
              >
                {localTxHash.slice(0, 14)}…
              </a>
            )}
            <p className="text-[11px] text-gray-400 mt-1">
              Wait for THORChain to send BCH to your address, then use Tracker /
              a CashTokens wallet for leg 2.
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
