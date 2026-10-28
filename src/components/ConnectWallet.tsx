"use client";

import {
  useAccount,
  useConnect,
  useDisconnect,
  useChainId,
  useSwitchChain,
} from "wagmi";
import { mainnet, bsc } from "wagmi/chains";
import clsx from "clsx";

export function ConnectWallet({
  preferredChainId,
}: {
  preferredChainId?: number;
}) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const target = preferredChainId ?? mainnet.id;
  const wrongChain = isConnected && chainId !== target;

  if (isConnected && address) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-mono text-xs text-gray-400">
          {address.slice(0, 6)}…{address.slice(-4)}
        </span>
        <span
          className={clsx(
            "text-[10px] px-1.5 py-0.5 rounded font-mono",
            wrongChain
              ? "bg-amber-500/20 text-amber-300"
              : "bg-bch/15 text-bch"
          )}
        >
          chain {chainId}
        </span>
        {wrongChain && switchChain && (
          <button
            type="button"
            onClick={() => switchChain({ chainId: target })}
            className="text-xs px-2 py-1 rounded border border-amber-500/40 text-amber-200 hover:bg-amber-500/10"
          >
            Switch to {target === bsc.id ? "BSC" : "Ethereum"}
          </button>
        )}
        <button
          type="button"
          onClick={() => disconnect()}
          className="text-xs px-2 py-1 rounded border border-surface-border text-gray-400 hover:text-white"
        >
          Disconnect
        </button>
      </div>
    );
  }

  const injected =
    connectors.find((c) => c.id === "injected") ?? connectors[0];

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={!injected || isPending}
        onClick={() => injected && connect({ connector: injected })}
        className="text-sm px-3 py-1.5 rounded-lg bg-bch/20 text-bch border border-bch/40 hover:bg-bch/30 disabled:opacity-40"
      >
        {isPending ? "Connecting…" : "Connect EVM wallet"}
      </button>
      {error && (
        <p className="text-[11px] text-amber-400">{error.message}</p>
      )}
    </div>
  );
}
