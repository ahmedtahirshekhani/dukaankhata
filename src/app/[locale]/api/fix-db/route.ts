import { getCollection, COLLECTIONS, createIndexes, setLastUpdated } from '@/lib/db/mongodb';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);
    const ledgerCollection = await getCollection(COLLECTIONS.PARTY_LEDGER_ENTRIES);
    const balanceStateCollection = await getCollection(COLLECTIONS.PARTY_BALANCE_STATE);
    const usersCollection = await getCollection(COLLECTIONS.USERS);
    
    // Check if index exists and drop it
    try {
      await customersCollection.dropIndex("email_1_user_id_1");
      console.log("Dropped email_1_user_id_1 index");
    } catch (e) {
      console.log("Index might not exist or already dropped:", e);
    }

    // Recreate indexes with new definition (sparse: true)
    await createIndexes();

    // Reconcile all parties' balances
    const allParties = await customersCollection.find({}).toArray();
    for (const party of allParties) {
      const latestEntry = await ledgerCollection.findOne(
        {
          user_id: party.user_id,
          $or: [{ party_id: party._id }, { customer_id: party._id }]
        },
        { sort: { effective_at: -1, created_at: -1 } }
      );

      const trueBalance = latestEntry
        ? Number(latestEntry.running_balance || 0)
        : Number(party.opening_balance || 0);

      await customersCollection.updateOne(
        { _id: party._id },
        {
          $set: {
            balance: trueBalance,
            updated_at: new Date(),
          },
        }
      );

      await balanceStateCollection.updateOne(
        { user_id: party.user_id, party_id: party._id },
        {
          $set: {
            current_balance: trueBalance,
            updated_at: new Date(),
          },
        },
        { upsert: true }
      );
    }

    // Touch all users to force sync update
    const users = await usersCollection.find({}).toArray();
    for (const user of users) {
      await setLastUpdated(usersCollection, { _id: user._id });
    }
    
    return NextResponse.json({ success: true, message: "Indexes updated and party balances reconciled successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fix DB: " + error.message }, { status: 500 });
  }
}
