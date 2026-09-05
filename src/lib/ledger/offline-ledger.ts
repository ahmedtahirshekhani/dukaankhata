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
