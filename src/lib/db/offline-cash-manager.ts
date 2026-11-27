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

  const syncPayload = {
    ...record,
    paymentMethodId: record.payment_method_id,
    accountName: record.account_name,
    payment_method_id: record.payment_method_id,
    account_name: record.account_name,
    refNo: record.ref_no,
    ref_no: record.ref_no,
  };

  // Queue for synchronization with server
  await SyncEngine.queueOperation(
    "cash_adjustments",
    "POST",
    "/api/cash-adjustments",
    syncPayload,
    adjId
  );

  return record;
}

export async function updateCashAdjustmentOffline(
  id: string,
  options: {
    paymentMethodId?: string;
    accountName?: string;
    type?: "add" | "reduce";
    amount?: number;
    reason?: string;
    notes?: string;
    date?: string | Date;
  }
): Promise<CashAdjustmentRecord | null> {
  let existing = await db.cash_adjustments.get(id);
  if (!existing) {
    const all = await db.cash_adjustments.toArray();
    existing = all.find((a: any) => a.id === id || a._id === id);
  }
  if (!existing) return null;

  const targetId = existing.id || id;
  const nowIso = new Date().toISOString();

  const updated: CashAdjustmentRecord = {
    ...existing,
    payment_method_id: options.paymentMethodId ?? existing.payment_method_id,
    account_name: options.accountName ?? existing.account_name,
    type: options.type ?? existing.type,
    amount: options.amount !== undefined ? Math.abs(Number(options.amount) || 0) : existing.amount,
    reason: options.reason ?? existing.reason,
    notes: options.notes !== undefined ? options.notes : existing.notes,
    date: options.date !== undefined ? toSafeISOString(options.date) : existing.date,
    updated_at: nowIso,
  };

  await db.cash_adjustments.put(updated);

  const syncPayload = {
    ...updated,
    paymentMethodId: updated.payment_method_id,
    accountName: updated.account_name,
    payment_method_id: updated.payment_method_id,
    account_name: updated.account_name,
    refNo: updated.ref_no,
    ref_no: updated.ref_no,
  };

  await SyncEngine.queueOperation(
    "cash_adjustments",
    "PUT",
    "/api/cash-adjustments",
    syncPayload,
    `update_cash_adj_${targetId}_${Date.now()}`
  );

  return updated;
}

export async function deleteCashAdjustmentOffline(id: string): Promise<boolean> {
  if (!id) return false;

  let existing = await db.cash_adjustments.get(id);
  if (!existing) {
    const all = await db.cash_adjustments.toArray();
    existing = all.find((a: any) => a.id === id || a._id === id);
  }

  const targetId = existing?.id || id;
  const serverId = existing?._id || existing?.id || id;

  await db.cash_adjustments.delete(targetId);
  if (existing?._id && existing._id !== targetId) {
    await db.cash_adjustments.delete(existing._id);
  }

  const refNo = existing?.ref_no;

  await SyncEngine.queueOperation(
    "cash_adjustments",
    "DELETE",
    `/api/cash-adjustments?id=${encodeURIComponent(serverId)}${refNo ? `&ref_no=${encodeURIComponent(refNo)}` : ""}`,
    { id: serverId, ref_no: refNo },
    `del_cash_adj_${Date.now()}`
  );

  return true;
}
