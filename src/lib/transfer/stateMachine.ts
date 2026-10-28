/**
 * Persistent multi-leg transfer state machine.
 * Stored in localStorage on the client. Never holds keys or seeds.
 */

import type { AssetId, NormalizedQuote } from "@/lib/types";

export type TransferState =
  | "DRAFT"
  | "QUOTED"
  | "AWAITING_SOURCE_SIGNATURE"
  | "SOURCE_BROADCAST"
  | "SOURCE_CONFIRMED"
  | "AWAITING_INTERMEDIATE"
  | "INTERMEDIATE_RECEIVED"
  | "AWAITING_DEST_QUOTE"
  | "DEST_QUOTED"
  | "AWAITING_DEST_SIGNATURE"
  | "DEST_BROADCAST"
  | "DEST_CONFIRMED"
  | "COMPLETED"
  | "FAILED"
  | "RECOVERY_REQUIRED";

export interface LegRecord {
  index: number;
  provider: "thorchain" | "cauldron" | "rango";
  from: AssetId;
  to: AssetId;
  quote?: NormalizedQuote;
  txHash?: string;
  status: "pending" | "signed" | "broadcast" | "confirmed" | "failed";
  notes?: string;
}

export interface TransferRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  state: TransferState;
  from: AssetId;
  to: AssetId;
  inputAmount: string;
  /** User-controlled destination addresses (never app-controlled) */
  destinationBch?: string;
  destinationEvm?: string;
  legs: LegRecord[];
  /** Intermediate asset held after leg 1 (usually BCH) */
  intermediateAsset?: AssetId;
  intermediateAmount?: string;
  error?: string;
  recoveryHint?: string;
}

const STORAGE_KEY = "bch-stablebridge-transfers";

export function createTransferId(): string {
  return `tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function loadTransfers(): TransferRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TransferRecord[];
  } catch {
    return [];
  }
}

export function saveTransfer(record: TransferRecord): void {
  if (typeof window === "undefined") return;
  const all = loadTransfers().filter((t) => t.id !== record.id);
  all.unshift({ ...record, updatedAt: Date.now() });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all.slice(0, 50)));
}

export function getTransfer(id: string): TransferRecord | undefined {
  return loadTransfers().find((t) => t.id === id);
}

export function advanceState(
  record: TransferRecord,
  next: TransferState,
  patch?: Partial<TransferRecord>
): TransferRecord {
  const updated: TransferRecord = {
    ...record,
    ...patch,
    state: next,
    updatedAt: Date.now(),
  };

  if (next === "RECOVERY_REQUIRED" && !updated.recoveryHint) {
    updated.recoveryHint =
      "Leg 1 may have completed while a later leg failed. Check your wallet for the intermediate asset (usually BCH). Do not re-send the source transaction. You can start a new BCH → destination swap when ready.";
  }

  saveTransfer(updated);
  return updated;
}

/** Valid transitions (strict) */
const ALLOWED: Record<TransferState, TransferState[]> = {
  DRAFT: ["QUOTED", "FAILED"],
  QUOTED: ["AWAITING_SOURCE_SIGNATURE", "FAILED", "DRAFT"],
  AWAITING_SOURCE_SIGNATURE: ["SOURCE_BROADCAST", "FAILED", "QUOTED"],
  SOURCE_BROADCAST: ["SOURCE_CONFIRMED", "FAILED", "RECOVERY_REQUIRED"],
  SOURCE_CONFIRMED: ["AWAITING_INTERMEDIATE", "COMPLETED", "FAILED"],
  AWAITING_INTERMEDIATE: ["INTERMEDIATE_RECEIVED", "FAILED", "RECOVERY_REQUIRED"],
  INTERMEDIATE_RECEIVED: ["AWAITING_DEST_QUOTE", "COMPLETED", "FAILED"],
  AWAITING_DEST_QUOTE: ["DEST_QUOTED", "RECOVERY_REQUIRED", "FAILED"],
  DEST_QUOTED: ["AWAITING_DEST_SIGNATURE", "RECOVERY_REQUIRED", "FAILED"],
  AWAITING_DEST_SIGNATURE: ["DEST_BROADCAST", "RECOVERY_REQUIRED", "FAILED"],
  DEST_BROADCAST: ["DEST_CONFIRMED", "RECOVERY_REQUIRED", "FAILED"],
  DEST_CONFIRMED: ["COMPLETED", "FAILED"],
  COMPLETED: [],
  FAILED: ["DRAFT"],
  RECOVERY_REQUIRED: ["AWAITING_DEST_QUOTE", "FAILED"],
};

export function canTransition(from: TransferState, to: TransferState): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}
