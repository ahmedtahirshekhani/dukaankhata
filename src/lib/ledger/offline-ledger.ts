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
export async function updateOfflinePartyBalance(partyId: string, amountDelta: number): Promise<void> {
  try {
    const party = await db.parties.get(partyId);
    if (!party) {
      console.warn(`[Offline Ledger] Party ${partyId} not found locally. Cannot update balance.`);
      return;
    }

    const currentBalance = party.balance ?? party.opening_balance ?? 0;
    const newBalance = currentBalance + amountDelta;

    await db.parties.update(partyId, { balance: newBalance });
    console.log(`[Offline Ledger] Updated party ${partyId} balance locally: ${currentBalance} -> ${newBalance}`);
  } catch (error) {
    console.error("[Offline Ledger] Failed to update party balance locally:", error);
  }
}
