"use client";

/**
 * THORChain EVM leg-1 execution panel.
 * Prepare → Approve (wait confirm) → depositWithExpiry → monitor THOR.
 * Leg 2 is NEVER auto-spent; recovery guidance only.
 */

import { useState, useCallback, useEffect } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useChainId,
} from "wagmi";
import { mainnet, bsc } from "wagmi/chains";
import { erc20Abi, thorRouterAbi } from "@/lib/wagmi/config";
import { ConnectWallet } from "./ConnectWallet";
import type { AssetId } from "@/lib/types";
import { getAsset } from "@/lib/assets/registry";
import {
  getEvmTokenAddress,
  getEvmChainId,
  isExecutableEvmAsset,
} from "@/lib/providers/evmTokens";
import {
  createTransferId,
  saveTransfer,
  getTransfer,
  type TransferRecord,
} from "@/lib/transfer/stateMachine";
import { leg2RecoveryHint } from "@/lib/bch/cauldronExecution";
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

type Leg1Phase =
  | "idle"
  | "prepared"
  | "approving"
  | "approve_pending"
  | "approved"
  | "depositing"
  | "deposit_pending"
  | "evm_confirmed"
  | "thor_pending"
  | "thor_observed"
  | "failed";

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
  const [phase, setPhase] = useState<Leg1Phase>("idle");
  const [transferId, setTransferId] = useState<string | null>(null);
  const [approveHash, setApproveHash] = useState<`0x${string}` | undefined>();
  const [depositHash, setDepositHash] = useState<`0x${string}` | undefined>();
  const [thorNote, setThorNote] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const executable = isExecutableEvmAsset(fromAsset);
  const fromMeta = getAsset(fromAsset);
  const preferredChain = executable ? getEvmChainId(fromAsset) : mainnet.id;
  const tokenAddress = executable
    ? getEvmTokenAddress(fromAsset)
    : ("0x0000000000000000000000000000000000000000" as const);

  const routerAddr = prep?.router as `0x${string}` | undefined;

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && routerAddr ? [address, routerAddr] : undefined,
    query: { enabled: Boolean(address && routerAddr && executable) },
  });

  const { data: balance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && executable) },
  });

  const {
    writeContractAsync,
    error: writeError,
    isPending: isWriting,
    reset: resetWrite,
  } = useWriteContract();

  const approveReceipt = useWaitForTransactionReceipt({ hash: approveHash });
  const depositReceipt = useWaitForTransactionReceipt({ hash: depositHash });

  const needsApprove =
    prep != null &&
    allowance !== undefined &&
    BigInt(prep.amountNative) > BigInt(allowance as bigint);

  const amountOk =
    balance !== undefined &&
    prep != null &&
    BigInt(balance as bigint) >= BigInt(prep.amountNative);

  const quoteExpired =
    prep != null && prep.expiry < Math.floor(Date.now() / 1000) + 30;

  useEffect(() => {
    if (approveReceipt.isSuccess && phase === "approve_pending") {
      setPhase("approved");
      void refetchAllowance();
    }
    if (approveReceipt.isError && phase === "approve_pending") {
      setPhase("failed");
      setStatusError("Approve transaction failed or reverted");
    }
  }, [approveReceipt.isSuccess, approveReceipt.isError, phase, refetchAllowance]);

  useEffect(() => {
    if (depositReceipt.isSuccess && phase === "deposit_pending") {
      setPhase("evm_confirmed");
      if (transferId) {
        const existing = getTransfer(transferId);
        if (existing) {
          saveTransfer({
            ...existing,
            state: "SOURCE_CONFIRMED",
            legs: existing.legs.map((l, i) =>
              i === 0
                ? { ...l, status: "confirmed", txHash: depositHash }
                : l
            ),
          });
        }
      }
    }
    if (depositReceipt.isError && phase === "deposit_pending") {
      setPhase("failed");
      setStatusError("Deposit transaction failed or reverted");
    }
  }, [depositReceipt.isSuccess, depositReceipt.isError, phase, transferId, depositHash]);

  useEffect(() => {
    if (phase !== "evm_confirmed" && phase !== "thor_pending") return;
    if (!depositHash) return;
    setPhase("thor_pending");
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/thor/status?tx=${encodeURIComponent(depositHash)}`
        );
        const data = await res.json();
        if (cancelled) return;
        setThorNote(data.notes ?? null);
        if (data.settled) {
          setPhase("thor_observed");
          if (transferId) {
            const existing = getTransfer(transferId);
            if (existing) {
              saveTransfer({
                ...existing,
                state: "AWAITING_INTERMEDIATE",
                recoveryHint: leg2RecoveryHint(
                  bchDestination,
                  prep
                    ? (Number(prep.expectedAmountOut) / 1e8).toFixed(8)
                    : undefined
                ),
              });
            }
          }
        }
      } catch {
        /* soft fail */
      }
    };
    void poll();
    const id = setInterval(poll, 20000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [phase, depositHash, transferId, bchDestination, prep]);

  const prepare = useCallback(async () => {
    if (!executable) {
      setPrepError(
        `${fromAsset} execution is not enabled yet. Use eth-usdt or bsc-usdt.`
      );
      return;
    }
    setPreparing(true);
    setPrepError(null);
    setPrep(null);
    setPhase("idle");
    setApproveHash(undefined);
    setDepositHash(undefined);
    setThorNote(null);
    setStatusError(null);
    resetWrite();
    try {
      if (!bchDestination || bchDestination.length < 15) {
        throw new Error(
          "Enter your BCH destination address (bitcoincash:… or q…)."
        );
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
      if (p.depositArgs.asset.toLowerCase() !== tokenAddress.toLowerCase()) {
        throw new Error(
          `Asset mismatch: prepare returned ${p.depositArgs.asset}, expected ${tokenAddress}`
        );
      }
      if ((p.expiry ?? 0) < Math.floor(Date.now() / 1000) + 60) {
        throw new Error("Quote expires too soon — prepare again");
      }
      const normalized: ThorPrep = {
        inboundAddress: p.inboundAddress,
        router: p.router,
        memo: p.memo,
        expiry: p.expiry!,
        amountNative: p.amountNative,
        expectedAmountOut: p.expectedAmountOut ?? "0",
        depositArgs: p.depositArgs,
      };
      setPrep(normalized);
      setPhase("prepared");

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
      setPhase("failed");
    } finally {
      setPreparing(false);
    }
  }, [
    amount,
    bchDestination,
    executable,
    fromAsset,
    toAsset,
    tokenAddress,
    resetWrite,
  ]);

  const runApprove = async () => {
    if (!prep || !address || !executable) return;
    setPhase("approving");
    setStatusError(null);
    try {
      const hash = await writeContractAsync({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [prep.router as `0x${string}`, BigInt(prep.amountNative)],
      });
      setApproveHash(hash);
      setPhase("approve_pending");
    } catch (e) {
      setPhase("prepared");
      setStatusError(
        e instanceof Error ? e.message.slice(0, 200) : "Approve rejected"
      );
    }
  };

  const runDeposit = async () => {
    if (!prep || !executable) return;
    if (quoteExpired) {
      setPrepError("Quote expired — click Prepare again");
      setPhase("idle");
      return;
    }
    if (prep.expiry < Math.floor(Date.now() / 1000) + 20) {
      setPrepError("Quote about to expire — prepare a fresh quote");
      return;
    }
    setPhase("depositing");
    setStatusError(null);
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
      setDepositHash(hash);
      setPhase("deposit_pending");
      if (transferId) {
        const existing = getTransfer(transferId);
        if (existing) {
          saveTransfer({
            ...existing,
            state: "SOURCE_BROADCAST",
            legs: existing.legs.map((l, i) =>
              i === 0 ? { ...l, status: "broadcast", txHash: hash } : l
            ),
          });
        }
      }
    } catch (e) {
      setPhase(needsApprove ? "approved" : "prepared");
      setStatusError(
        e instanceof Error ? e.message.slice(0, 200) : "Deposit rejected"
      );
    }
  };

  const wrongChain = isConnected && chainId !== preferredChain;
  const canDeposit =
    Boolean(prep) &&
    isConnected &&
    !wrongChain &&
    amountOk &&
    !needsApprove &&
    (phase === "prepared" || phase === "approved") &&
    !quoteExpired;

  if (!executable) {
    return (
      <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
        Execution for <span className="font-mono">{fromAsset}</span> is not
        enabled. Use <span className="font-mono">eth-usdt</span> or{" "}
        <span className="font-mono">bsc-usdt</span> until USDC path is validated.
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-xl border border-surface-border bg-surface-raised p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold">
          Execute leg 1 — THORChain ({fromMeta.symbol} → BCH)
        </h3>
        <ConnectWallet preferredChainId={preferredChain} />
      </div>

      <p className="text-[11px] text-gray-500">
        Non-custodial. Approve and deposit only after reviewing parameters. Leg 2
        (BCH → PUSD) is <strong className="text-gray-300">never</strong> spent
        automatically — verify BCH in your wallet, then swap in a CashTokens wallet
        (e.g. Paytaca).
      </p>

      <div className="text-[11px] font-mono text-gray-500">
        Token {tokenAddress.slice(0, 10)}… · chain {preferredChain} · decimals{" "}
        {fromMeta.decimals} · phase {phase}
      </div>

      <div>
        <label className="text-xs text-gray-500">Your BCH destination address</label>
        <input
          type="text"
          value={bchDestination}
          onChange={(e) => onBchDestinationChange(e.target.value.trim())}
          placeholder="bitcoincash:q… (prefix stripped for THOR memo)"
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

      {(prepError || statusError) && (
        <div className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          {prepError || statusError}
        </div>
      )}

      {prep && (
        <div className="text-xs space-y-2 font-mono bg-surface-overlay rounded-lg p-3 border border-surface-border">
          <Row label="Inbound" value={prep.inboundAddress} />
          <Row label="Router" value={prep.router} />
          <Row label="Asset (deposit)" value={prep.depositArgs.asset} />
          <Row label="Amount (native)" value={prep.amountNative} />
          <Row label="Memo" value={prep.memo} />
          <Row
            label="Expiry"
            value={new Date(prep.expiry * 1000).toLocaleString()}
            warn={quoteExpired}
          />
          <Row
            label="Expected BCH (est.)"
            value={(Number(prep.expectedAmountOut) / 1e8).toFixed(8)}
          />
          {balance !== undefined && (
            <Row
              label={`${fromMeta.symbol} balance (raw)`}
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
          {needsApprove &&
            phase !== "evm_confirmed" &&
            phase !== "thor_pending" &&
            phase !== "thor_observed" &&
            phase !== "deposit_pending" && (
              <button
                type="button"
                onClick={runApprove}
                disabled={
                  isWriting ||
                  approveReceipt.isLoading ||
                  !amountOk ||
                  phase === "approve_pending"
                }
                className="w-full py-2.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-100 text-sm font-medium disabled:opacity-40"
              >
                {phase === "approve_pending" || approveReceipt.isLoading
                  ? "Waiting for approve confirmation…"
                  : phase === "approving"
                    ? "Confirm approve in wallet…"
                    : `1. Approve ${fromMeta.symbol} for THOR router`}
              </button>
            )}
          <button
            type="button"
            onClick={runDeposit}
            disabled={
              !canDeposit || isWriting || depositReceipt.isLoading
            }
            className="w-full py-2.5 rounded-lg bg-bch text-black text-sm font-semibold disabled:opacity-40"
          >
            {phase === "deposit_pending" || depositReceipt.isLoading
              ? "Waiting for deposit confirmation…"
              : phase === "depositing"
                ? "Confirm deposit in wallet…"
                : "2. Deposit via depositWithExpiry"}
          </button>
        </div>
      )}

      {writeError && (
        <p className="text-xs text-amber-400">{writeError.message.slice(0, 240)}</p>
      )}

      {(depositHash ||
        phase === "evm_confirmed" ||
        phase === "thor_pending" ||
        phase === "thor_observed") && (
        <div
          className={clsx(
            "text-sm rounded-lg p-3 border flex gap-2",
            phase === "thor_observed"
              ? "bg-bch/10 border-bch/30 text-bch"
              : "bg-surface-overlay border-surface-border text-gray-300"
          )}
        >
          {phase === "thor_observed" ? (
            <CheckCircle2 size={16} />
          ) : (
            <Loader2 size={16} className="animate-spin" />
          )}
          <div className="space-y-1">
            <p>
              {phase === "thor_observed"
                ? "THOR observed inbound — verify BCH in your wallet."
                : phase === "evm_confirmed" || phase === "thor_pending"
                  ? "EVM deposit confirmed — monitoring THORChain…"
                  : "Deposit submitted…"}
            </p>
            {depositHash && (
              <a
                href={
                  preferredChain === bsc.id
                    ? `https://bscscan.com/tx/${depositHash}`
                    : `https://etherscan.io/tx/${depositHash}`
                }
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs underline"
              >
                {depositHash.slice(0, 14)}…
              </a>
            )}
            {thorNote && (
              <p className="text-[11px] text-gray-400">{thorNote}</p>
            )}
            <p className="text-[11px] text-amber-200/90 pt-1">
              {leg2RecoveryHint(
                bchDestination,
                prep
                  ? (Number(prep.expectedAmountOut) / 1e8).toFixed(8)
                  : undefined
              )}
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
