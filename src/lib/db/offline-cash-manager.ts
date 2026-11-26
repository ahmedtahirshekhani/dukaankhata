import { db } from "@/lib/db/offline-db";
import { SyncEngine } from "@/lib/sync/sync-engine";
import { toSafeISOString } from "@/lib/date-utils";

export interface CashAdjustmentRecord {
  id: string;
  _id?: string;
  ref_no: string;
  payment_method_id: string;
  account_name?: string;
  type: "add" | "reduce";
  amount: number;
  reason: string;
  notes?: string;
  date: string;
  created_at: string;
  updated_at: string;
  is_deleted?: boolean;
}

export async function recordCashAdjustmentOffline(options: {
  paymentMethodId: string;
  accountName?: string;
  type: "add" | "reduce";
  amount: number;
  reason: string;
  notes?: string;
  date?: string | Date;
}): Promise<CashAdjustmentRecord> {
  const { paymentMethodId, accountName, type, amount, reason, notes, date } = options;

  const adjId = `local_cash_adj_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const refNo = `CADJ-${Date.now().toString().slice(-6)}`;
  const dateIso = toSafeISOString(date);
  const nowIso = new Date().toISOString();

  const record: CashAdjustmentRecord = {
    id: adjId,
    ref_no: refNo,
    payment_method_id: paymentMethodId || "cash",
    account_name: accountName || "Cash in Hand",
    type,
    amount: Math.abs(Number(amount) || 0),
    reason: reason || "Manual Cash Adjustment",
    notes: notes || "",
    date: dateIso,
    created_at: nowIso,
    updated_at: nowIso,
  };

  await db.cash_adjustments.put(record);

  // Queue for synchronization with server
  await SyncEngine.queueOperation(
    "cash_adjustments",
    "POST",
    "/api/cash-adjustments",
    record,
    adjId
  );

  return record;
}
