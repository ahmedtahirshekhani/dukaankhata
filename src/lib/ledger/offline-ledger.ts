// src/lib/ledger/offline-ledger.ts
import { db } from "../db/offline-db";

/**
 * Updates the balance of a party locally in Dexie IndexedDB.
 * This ensures the UI reflects balance changes immediately before the server syncs.
 * 
 * @param partyId The ID of the party (Customer/Supplier)
 * @param amountDelta The amount to change. 
 *                    Positive adds to the balance (increases receivable or decreases payable).
 *                    Negative subtracts from the balance (decreases receivable or increases payable).
 */
export async function updateOfflinePartyBalance(partyId: string | number | undefined | null, amountDelta: number | string | undefined | null): Promise<void> {
  try {
    if (!partyId) {
      console.warn("[Offline Ledger] No partyId provided to updateOfflinePartyBalance");
      return;
    }
    const idStr = partyId.toString();
    const delta = typeof amountDelta === 'number' ? amountDelta : parseFloat(String(amountDelta || 0));
    if (isNaN(delta) || delta === 0) return;

    let party = await db.parties.get(idStr);
    if (!party) {
      party = await db.parties.where('id').equals(idStr).first();
    }
    if (!party) {
      party = await db.parties.where('_id').equals(idStr).first();
    }

    if (!party) {
      console.warn(`[Offline Ledger] Party ${idStr} not found locally. Cannot update balance.`);
      return;
    }

    const currentBalance = Number(party.balance ?? party.opening_balance ?? 0);
    const newBalance = Math.round((currentBalance + delta) * 100) / 100;

    await db.parties.update(party.id, { balance: newBalance });
    console.log(`[Offline Ledger] Updated party ${party.id} (${party.name}) balance locally: ${currentBalance} -> ${newBalance}`);
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('partyBalanceUpdated', { 
        detail: { partyId: party.id, oldBalance: currentBalance, newBalance } 
      }));
    }
  } catch (error) {
    console.error("[Offline Ledger] Failed to update party balance locally:", error);
  }
}

/**
 * Reconciles the offline balance of a party from its actual active Dexie transactions.
 * If 0 active transactions exist, balance is strictly set to opening_balance.
 */
export async function reconcileOfflinePartyBalance(partyId: string | number | undefined | null): Promise<number> {
  if (!partyId) return 0;
  const pIdStr = partyId.toString();

  try {
    let party = await db.parties.get(pIdStr);
    if (!party) {
      party = await db.parties.where('id').equals(pIdStr).first();
    }
    if (!party) {
      party = await db.parties.where('_id').equals(pIdStr).first();
    }
    if (!party) return 0;

    const openingBalance = Number(party.opening_balance ?? 0);

    const isItemDeleted = (item: any) => {
      if (!item) return true;
      if (item.is_delete === 1 || item.is_delete === true || item.is_delete === "1") return true;
      if (item.is_deleted === 1 || item.is_deleted === true || item.is_deleted === "1") return true;
      if (typeof item.status === "string") {
        const s = item.status.toLowerCase().trim();
        if (s === "cancelled" || s === "deleted" || s === "inactive") return true;
      }
      return false;
    };

    const orders = await db.orders
      .filter((o: any) => !isItemDeleted(o) && String(o.customer_id || o.customerId || o.party_id || o.partyId || "").trim() === pIdStr)
      .toArray();

    const purchaseBills = await db.purchase_bills
      .filter((b: any) => !isItemDeleted(b) && String(b.party_id || b.partyId || "").trim() === pIdStr)
      .toArray();

    const saleReturns = await db.sale_return_transactions
      .filter((r: any) => !isItemDeleted(r) && String(r.customerId || r.customer_id || r.party_id || r.partyId || "").trim() === pIdStr)
      .toArray();

    const partyTransactions = await db.party_transactions
      .filter((t: any) => !isItemDeleted(t) && String(t.customerId || t.customer_id || t.party_id || t.partyId || "").trim() === pIdStr)
      .toArray();

    const totalActive = orders.length + purchaseBills.length + saleReturns.length + partyTransactions.length;

    let trueBalance = openingBalance;
    if (totalActive > 0) {
      const netOrders = orders.reduce((sum, o: any) => {
        const tot = Number(o.total_amount ?? 0);
        const paid = Number(o.payment?.paid_amount ?? 0);
        return sum + (tot - paid);
      }, 0);

      const netReturns = saleReturns.reduce((sum, r: any) => {
        const tot = Number(r.total_amount ?? r.payment_amount ?? 0);
        const refund = Number(r.paid_amount ?? r.refund_amount ?? 0);
        return sum + (tot - refund);
      }, 0);

      const netPurchases = purchaseBills.reduce((sum, b: any) => {
        const tot = Number(b.total_amount ?? 0);
        const paid = Number(b.paid_amount ?? 0);
        return sum + (tot - paid);
      }, 0);

      const netPayments = partyTransactions.reduce((sum, t: any) => {
        const amt = Number(t.payment_amount ?? t.amount ?? 0);
        const isPaymentIn = t.type === "payment-in" || t.type === "payment_in";
        return isPaymentIn ? sum - amt : sum + amt;
      }, 0);

      trueBalance = openingBalance + netOrders - netReturns - netPurchases + netPayments;
    }

    trueBalance = Math.round(trueBalance * 100) / 100;

    if (party.balance !== trueBalance) {
      await db.parties.update(party.id, { balance: trueBalance });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('partyBalanceUpdated', { 
          detail: { partyId: party.id, oldBalance: party.balance, newBalance: trueBalance } 
        }));
      }
    }

    return trueBalance;
  } catch (err) {
    console.error("[Offline Ledger] Failed to reconcile offline party balance:", err);
    return 0;
  }
}
