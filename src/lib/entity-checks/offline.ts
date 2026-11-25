import { db } from "@/lib/db/offline-db";

export function isOfflineEntityDeleted(item: any): boolean {
  if (!item) return true;
  if (item.is_delete === 1 || item.is_delete === true || item.is_delete === "1") return true;
  if (item.is_deleted === 1 || item.is_deleted === true || item.is_deleted === "1" || item.isDeleted === true || item.isDeleted === 1) return true;
  if (item.isDelete === 1 || item.isDelete === true || item.isDelete === "1") return true;
  if (item.deleted_at || item.deletedAt) return true;
  if (typeof item.status === "string") {
    const s = item.status.toLowerCase().trim();
    if (s === "cancelled" || s === "deleted" || s === "inactive") return true;
  }
  return false;
}

export interface EntityTransactionCheckResult {
  hasTransactions: boolean;
  counts: {
    orders: number;
    purchaseBills: number;
    saleReturns: number;
    partyTransactions: number;
    vendorTransactions: number;
    stockAdjustments: number;
    inventoryBatches: number;
    ledgerEntries: number;
    transactions: number;
    quotations: number;
  };
  details: string[];
  summary: string;
}

/**
 * Checks whether a party / customer has any associated transactions in IndexedDB across ALL collections.
 */
export async function checkPartyHasTransactionsOffline(
  partyId: string | number
): Promise<EntityTransactionCheckResult> {
  const pIdStr = String(partyId).trim();
  const counts = {
    orders: 0,
    purchaseBills: 0,
    saleReturns: 0,
    partyTransactions: 0,
    vendorTransactions: 0,
    stockAdjustments: 0,
    inventoryBatches: 0,
    ledgerEntries: 0,
    transactions: 0,
    quotations: 0,
  };

  if (!pIdStr) {
    return {
      hasTransactions: false,
      counts,
      details: [],
      summary: "",
    };
  }

  // 1. Orders / Sales Invoices
  try {
    counts.orders = await db.orders
      .filter((o: any) => {
        if (isOfflineEntityDeleted(o)) return false;
        const cId = String(o.customer_id || o.customerId || o.party_id || o.partyId || "").trim();
        return cId === pIdStr;
      })
      .count();
  } catch (e) {
    console.warn("[checkPartyHasTransactionsOffline] Error checking orders:", e);
  }

  // 2. Purchase Bills
  try {
    counts.purchaseBills = await db.purchase_bills
      .filter((b: any) => {
        if (isOfflineEntityDeleted(b)) return false;
        const pId = String(b.party_id || b.partyId || "").trim();
        return pId === pIdStr;
      })
      .count();
  } catch (e) {
    console.warn("[checkPartyHasTransactionsOffline] Error checking purchase bills:", e);
  }

  // 3. Sale Returns
  try {
    counts.saleReturns = await db.sale_return_transactions
      .filter((r: any) => {
        if (isOfflineEntityDeleted(r)) return false;
        const cId = String(r.customerId || r.customer_id || r.party_id || r.partyId || "").trim();
        return cId === pIdStr;
      })
      .count();
  } catch (e) {
    console.warn("[checkPartyHasTransactionsOffline] Error checking sale returns:", e);
  }

  // 4. Party Transactions (Payment In / Payment Out)
  try {
    counts.partyTransactions = await db.party_transactions
      .filter((t: any) => {
        if (isOfflineEntityDeleted(t)) return false;
        const cId = String(t.customerId || t.customer_id || t.party_id || t.partyId || "").trim();
        return cId === pIdStr;
      })
      .count();
  } catch (e) {
    console.warn("[checkPartyHasTransactionsOffline] Error checking party transactions:", e);
  }

  // 5. Vendor Transactions
  try {
    if (db.vendor_transactions) {
      counts.vendorTransactions = await db.vendor_transactions
        .filter((vt: any) => {
          if (isOfflineEntityDeleted(vt)) return false;
          const vId = String(vt.vendor_id || vt.vendorId || vt.party_id || vt.partyId || vt.customerId || vt.customer_id || "").trim();
          return vId === pIdStr;
        })
        .count();
    }
  } catch (e) {
    console.warn("[checkPartyHasTransactionsOffline] Error checking vendor transactions:", e);
  }

  // 6. Party Ledger Entries (excluding pure opening balance)
  try {
    if (db.party_ledger_entries) {
      counts.ledgerEntries = await db.party_ledger_entries
        .filter((l: any) => {
          if (isOfflineEntityDeleted(l)) return false;
          const lPartyId = String(l.party_id || l.partyId || "").trim();
          if (lPartyId !== pIdStr) return false;
          const evType = String(l.event_type || l.eventType || "").toLowerCase();
          if (evType === "opening_balance" || evType === "opening") return false;
          return true;
        })
        .count();
    }
  } catch (e) {
    console.warn("[checkPartyHasTransactionsOffline] Error checking party ledger entries:", e);
  }

  // 7. General Transactions
  try {
    if (db.transactions) {
      counts.transactions = await db.transactions
        .filter((tx: any) => {
          if (isOfflineEntityDeleted(tx)) return false;
          const tId = String(tx.customer_id || tx.customerId || tx.party_id || tx.partyId || "").trim();
          return tId === pIdStr;
        })
        .count();
    }
  } catch (e) {
    console.warn("[checkPartyHasTransactionsOffline] Error checking general transactions:", e);
  }

  // 8. Quotations
  try {
    counts.quotations = await db.quotations
      .filter((quo: any) => {
        if (isOfflineEntityDeleted(quo)) return false;
        const cId = String(quo.party_id || quo.partyId || quo.customer_id || quo.customerId || "").trim();
        return cId === pIdStr;
      })
      .count();
  } catch (e) {
    console.warn("[checkPartyHasTransactionsOffline] Error checking quotations:", e);
  }

  const details: string[] = [];
  if (counts.orders > 0) details.push(`${counts.orders} Sales Invoice(s)`);
  if (counts.purchaseBills > 0) details.push(`${counts.purchaseBills} Purchase Bill(s)`);
  if (counts.saleReturns > 0) details.push(`${counts.saleReturns} Sale Return(s)`);
  if (counts.partyTransactions > 0) details.push(`${counts.partyTransactions} Payment(s)`);
  if (counts.vendorTransactions > 0) details.push(`${counts.vendorTransactions} Vendor Transaction(s)`);
  if (counts.transactions > 0) details.push(`${counts.transactions} Transaction Record(s)`);
  if (counts.quotations > 0) details.push(`${counts.quotations} Quotation(s)`);

  const hasTransactions = details.length > 0;
  return {
    hasTransactions,
    counts,
    details,
    summary: details.join(", "),
  };
}

/**
 * Checks whether an item / product has any associated transactions in IndexedDB across ALL collections.
 */
export async function checkProductHasTransactionsOffline(
  productId: string | number
): Promise<EntityTransactionCheckResult> {
  const prodIdStr = String(productId).trim();
  const counts = {
    orders: 0,
    purchaseBills: 0,
    saleReturns: 0,
    partyTransactions: 0,
    vendorTransactions: 0,
    stockAdjustments: 0,
    inventoryBatches: 0,
    ledgerEntries: 0,
    transactions: 0,
    quotations: 0,
  };

  if (!prodIdStr) {
    return {
      hasTransactions: false,
      counts,
      details: [],
      summary: "",
    };
  }

  // 1. Orders / Sales Invoices
  try {
    counts.orders = await db.orders
      .filter((o: any) => {
        if (isOfflineEntityDeleted(o)) return false;
        if (!Array.isArray(o.items)) return false;
        return o.items.some((item: any) => {
          const id = String(item.product_id || item.productId || item.id || "").trim();
          return id === prodIdStr;
        });
      })
      .count();
  } catch (e) {
    console.warn("[checkProductHasTransactionsOffline] Error checking orders:", e);
  }

  // 2. Purchase Bills
  try {
    counts.purchaseBills = await db.purchase_bills
      .filter((b: any) => {
        if (isOfflineEntityDeleted(b)) return false;
        if (!Array.isArray(b.items)) return false;
        return b.items.some((item: any) => {
          const id = String(item.product_id || item.productId || item.id || "").trim();
          return id === prodIdStr;
        });
      })
      .count();
  } catch (e) {
    console.warn("[checkProductHasTransactionsOffline] Error checking purchase bills:", e);
  }

  // 3. Sale Returns
  try {
    counts.saleReturns = await db.sale_return_transactions
      .filter((r: any) => {
        if (isOfflineEntityDeleted(r)) return false;
        if (!Array.isArray(r.items)) return false;
        return r.items.some((item: any) => {
          const id = String(item.productId || item.product_id || item.id || "").trim();
          return id === prodIdStr;
        });
      })
      .count();
  } catch (e) {
    console.warn("[checkProductHasTransactionsOffline] Error checking sale returns:", e);
  }

  // 4. Stock Adjustments
  try {
    counts.stockAdjustments = await db.stock_adjustments
      .filter((a: any) => {
        if (isOfflineEntityDeleted(a)) return false;
        const directId = String(a.product_id || a.productId || "").trim();
        if (directId === prodIdStr) return true;
        if (Array.isArray(a.items)) {
          return a.items.some((item: any) => {
            const id = String(item.product_id || item.productId || item.id || "").trim();
            return id === prodIdStr;
          });
        }
        return false;
      })
      .count();
  } catch (e) {
    console.warn("[checkProductHasTransactionsOffline] Error checking stock adjustments:", e);
  }

  // 5. Inventory Batches (Purchases, returns, adjustments, or consumed opening batches)
  try {
    if (db.inventory_batches) {
      counts.inventoryBatches = await db.inventory_batches
        .filter((b: any) => {
          const pId = String(b.product_id || b.productId || "").trim();
          if (pId !== prodIdStr) return false;
          // If batch was created from purchase, adjustment, return, or manual batching
          const srcType = String(b.source_type || "").toLowerCase();
          if (srcType && srcType !== "opening_stock" && srcType !== "opening") {
            return true;
          }
          // If opening stock batch, check if any units were consumed/sold
          const initQty = Number(b.initial_quantity || 0);
          const remQty = Number(b.remaining_quantity || 0);
          if (initQty > 0 && remQty < initQty) {
            return true;
          }
          return false;
        })
        .count();
    }
  } catch (e) {
    console.warn("[checkProductHasTransactionsOffline] Error checking inventory batches:", e);
  }

  // 6. Quotations
  try {
    counts.quotations = await db.quotations
      .filter((quo: any) => {
        if (!Array.isArray(quo.items)) return false;
        return quo.items.some((item: any) => {
          const id = String(item.productId || item.product_id || item.id || "").trim();
          return id === prodIdStr;
        });
      })
      .count();
  } catch (e) {
    console.warn("[checkProductHasTransactionsOffline] Error checking quotations:", e);
  }

  const details: string[] = [];
  if (counts.orders > 0) details.push(`${counts.orders} Sales Invoice(s)`);
  if (counts.purchaseBills > 0) details.push(`${counts.purchaseBills} Purchase Bill(s)`);
  if (counts.saleReturns > 0) details.push(`${counts.saleReturns} Sale Return(s)`);
  if (counts.stockAdjustments > 0) details.push(`${counts.stockAdjustments} Stock Adjustment(s)`);
  if (counts.inventoryBatches > 0) details.push(`${counts.inventoryBatches} Inventory Batch(es)`);
  if (counts.quotations > 0) details.push(`${counts.quotations} Quotation(s)`);

  const hasTransactions = details.length > 0;
  return {
    hasTransactions,
    counts,
    details,
    summary: details.join(", "),
  };
}
