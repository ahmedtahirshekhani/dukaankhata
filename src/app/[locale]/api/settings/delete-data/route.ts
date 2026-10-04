import { auth } from "@/auth";
import { getCollection, COLLECTIONS, toObjectId, setLastUpdated, updateUserLastActivity } from "@/lib/db/mongodb";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { password } = await request.json();

    if (!password) {
      return Response.json({ error: "Password is required" }, { status: 400 });
    }

    // Get user from database to verify password
    const usersCollection = await getCollection(COLLECTIONS.USERS);
    const user = await usersCollection.findOne({
      email: session.user.email,
    });

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return Response.json({ error: "Invalid password" }, { status: 401 });
    }

    const workspaceId = toObjectId(session.user.id);
    const filter = { user_id: { $in: [workspaceId, workspaceId.toString()] } };

    // List of collections to clear
    const collectionsToClear = [
      COLLECTIONS.PRODUCTS,
      COLLECTIONS.PARTIES,
      COLLECTIONS.ORDERS,
      COLLECTIONS.ORDER_ITEMS,
      COLLECTIONS.PARTY_TRANSACTIONS,
      COLLECTIONS.VENDOR_TRANSACTIONS,
      COLLECTIONS.SALE_RETURN_TRANSACTIONS,
      COLLECTIONS.PURCHASE_BILLS,
      COLLECTIONS.PARTY_LEDGER_ENTRIES,
      COLLECTIONS.PARTY_BALANCE_STATE,
      COLLECTIONS.EXPENSES,
      COLLECTIONS.TRANSACTIONS,
      COLLECTIONS.QUOTATIONS,
      COLLECTIONS.CATEGORIES,
      COLLECTIONS.BRANCHES,
      COLLECTIONS.PAYMENT_METHODS,
    ];

    console.log(`\n========================================`);
    console.log(`[DELETE_ALL_DATA] Starting deletion for User/Workspace ID: ${workspaceId}`);
    console.log(`========================================`);

    // Delete isolated data from each collection
    let totalDeleted = 0;
    
    // Fetch Cash Sale party and Cash in Hand method to exclude/reset
    const partiesCollection = await getCollection(COLLECTIONS.PARTIES);
    const cashParty = await partiesCollection.findOne({ ...filter, is_default: true });
    
    const pmCollection = await getCollection(COLLECTIONS.PAYMENT_METHODS);
    const cashMethod = await pmCollection.findOne({ ...filter, is_default: true });

    for (const collectionName of collectionsToClear) {
      const collection = await getCollection(collectionName);
      let currentFilter: any = { ...filter };

      if (collectionName === COLLECTIONS.PARTIES) {
         currentFilter.is_default = { $ne: true };
      } else if (collectionName === COLLECTIONS.PAYMENT_METHODS) {
         currentFilter.is_default = { $ne: true };
      } else if (collectionName === COLLECTIONS.PARTY_BALANCE_STATE && cashParty) {
         currentFilter.party_id = { $ne: cashParty._id };
      }

      // First check how much data exists
      const count = await collection.countDocuments(currentFilter);
      
      if (count > 0) {
        console.log(`- Deleting ${count} records from ${collectionName}...`);
        const result = await collection.deleteMany(currentFilter);
        console.log(`  ✓ Successfully deleted ${result.deletedCount} records from ${collectionName}`);
        totalDeleted += result.deletedCount;
      } else {
        console.log(`- No records found in ${collectionName}`);
      }
    }

    // Reset all remaining parties (e.g. default Cash Sale) balance and opening_balance to 0
    await partiesCollection.updateMany(
      filter,
      {
        $set: {
          balance: 0,
          opening_balance: 0,
          updated_at: new Date(),
        },
      }
    );

    // Reset all remaining payment methods (e.g. Cash in Hand) to 0
    await pmCollection.updateMany(
      filter,
      {
        $set: {
          current_balance: 0,
          opening_balance: 0,
          updated_at: new Date(),
        },
      }
    );

    // Clear party balance state collection
    const balanceCollection = await getCollection(COLLECTIONS.PARTY_BALANCE_STATE);
    await balanceCollection.deleteMany(filter);

    console.log(`========================================`);
    console.log(`[DELETE_ALL_DATA] Deletion Complete. Total records deleted: ${totalDeleted}`);
    console.log(`========================================\n`);
    
    // Update user's last updated timestamp and activity
    await setLastUpdated(usersCollection, { _id: user._id });
    await updateUserLastActivity();

    // We deleted payment_methods, which included "Cash in Hand" etc.
    return Response.json({ success: true, message: "All workspace data deleted successfully" });
  } catch (error) {
    console.error("[DELETE_ALL_DATA]", error);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
