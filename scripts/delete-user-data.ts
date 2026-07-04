import "dotenv/config";
import { Db, MongoClient, ObjectId } from "mongodb";

import { COLLECTIONS } from "../src/lib/db/mongodb";

const MONGODB_URL = process.env.MONGODB_URL;
const DB_NAME = process.env.MONGODB_DB_NAME || "dukaankhata";

const TARGET_USER_IDS = [
  "694d8021f699de69cddf34b5",
];

if (!MONGODB_URL) {
  throw new Error("Missing MONGODB_URL in environment.");
}

type DeleteResult = {
  label: string;
  deletedCount: number;
};

function parseArgs() {
  return {
    dryRun: process.argv.includes("--dry-run"),
  };
}

function asObjectId(value: string): ObjectId {
  if (!ObjectId.isValid(value)) {
    throw new Error(`Invalid ObjectId: ${value}`);
  }
  return new ObjectId(value);
}

async function deleteByUserId(
  db: Db,
  collectionName: string,
  userId: string,
  userObjectId: ObjectId,
): Promise<number> {
  const result = await db.collection(collectionName).deleteMany({
    user_id: { $in: [userObjectId, userId] },
  });
  return result.deletedCount ?? 0;
}

async function deleteUserData(db: Db, userId: string, dryRun: boolean): Promise<DeleteResult[]> {
  const userObjectId = asObjectId(userId);
  const usersCollection = db.collection(COLLECTIONS.USERS);
  const userDoc = await usersCollection.findOne({ _id: userObjectId });
  const userEmail = userDoc?.email || "";

  const orderIds = await db
    .collection(COLLECTIONS.ORDERS)
    .distinct("_id", { user_id: { $in: [userObjectId, userId] } });

  const results: DeleteResult[] = [];

  const deleteCollection = async (label: string, collectionName: string) => {
    const deletedCount = dryRun
      ? await db.collection(collectionName).countDocuments({ user_id: { $in: [userObjectId, userId] } })
      : await deleteByUserId(db, collectionName, userId, userObjectId);
    results.push({ label, deletedCount });
  };

  await deleteCollection("products", COLLECTIONS.PRODUCTS);
  await deleteCollection("parties", COLLECTIONS.PARTIES);
  await deleteCollection("payment_method", COLLECTIONS.PAYMENT_METHOD);
  await deleteCollection("orders", COLLECTIONS.ORDERS);
  await deleteCollection("party_transaction", COLLECTIONS.PARTY_TRANSACTIONS);
  await deleteCollection("vendor_transaction", COLLECTIONS.VENDOR_TRANSACTIONS);
  await deleteCollection("sale_return_transaction", COLLECTIONS.SALE_RETURN_TRANSACTIONS);
  await deleteCollection("purchase_bills", COLLECTIONS.PURCHASE_BILLS);
  await deleteCollection("party_ledger_entries", COLLECTIONS.PARTY_LEDGER_ENTRIES);
  await deleteCollection("party_balance_state", COLLECTIONS.PARTY_BALANCE_STATE);
  await deleteCollection("expenses", COLLECTIONS.EXPENSES);
  await deleteCollection("transactions", COLLECTIONS.TRANSACTIONS);
  await deleteCollection("quotations", COLLECTIONS.QUOTATIONS);
  await deleteCollection("categories", COLLECTIONS.CATEGORIES);
  await deleteCollection("branches", COLLECTIONS.BRANCHES);
  await deleteCollection("chathistories", "chathistories");

  if (userEmail) {
    const passwordResetsCount = dryRun
      ? await db.collection(COLLECTIONS.PASSWORD_RESETS).countDocuments({ email: userEmail })
      : (await db.collection(COLLECTIONS.PASSWORD_RESETS).deleteMany({ email: userEmail })).deletedCount ?? 0;

    const verificationCodesCount = dryRun
      ? await db.collection(COLLECTIONS.EMAIL_VERIFICATION_CODES).countDocuments({ email: userEmail })
      : (await db.collection(COLLECTIONS.EMAIL_VERIFICATION_CODES).deleteMany({ email: userEmail })).deletedCount ?? 0;

    results.push({ label: "password_resets", deletedCount: passwordResetsCount });
    results.push({ label: "email_verification_codes", deletedCount: verificationCodesCount });

    const waitlistCount = dryRun
      ? await db.collection(COLLECTIONS.WAITLIST).countDocuments({ email: userEmail })
      : (await db.collection(COLLECTIONS.WAITLIST).deleteMany({ email: userEmail })).deletedCount ?? 0;

    if (waitlistCount > 0) {
      results.push({ label: "waitlist", deletedCount: waitlistCount });
    }
  }

  if (orderIds.length > 0) {
    const orderItemsCount = dryRun
      ? await db.collection(COLLECTIONS.ORDER_ITEMS).countDocuments({ order_id: { $in: orderIds } })
      : (await db.collection(COLLECTIONS.ORDER_ITEMS).deleteMany({ order_id: { $in: orderIds } })).deletedCount ?? 0;

    results.push({ label: "order_items", deletedCount: orderItemsCount });
  }

  const userDeleteCount = dryRun
    ? await usersCollection.countDocuments({ _id: userObjectId })
    : (await usersCollection.updateOne(
        { _id: userObjectId },
        {
          $set: {
            isDeleted: false,
            deletedAt: new Date(),
          },
        }
      )).matchedCount ?? 0;
  results.push({ label: "users_flagged", deletedCount: userDeleteCount });

  return results;
}

async function main() {
  const { dryRun } = parseArgs();
  const client = new MongoClient(MONGODB_URL!);

  await client.connect();
  console.log("Connected to MongoDB.");

  try {
    const db = client.db(DB_NAME);

    for (const userId of TARGET_USER_IDS) {
      console.log(`Processing ${userId}${dryRun ? " [dry-run]" : ""}...`);
      const results = await deleteUserData(db, userId, dryRun);

      for (const result of results) {
        console.log(`${result.label}: ${result.deletedCount}${dryRun ? " (would delete)" : " deleted"}`);
      }
    }

    console.log(dryRun ? "Dry run complete." : "User data purge complete.");
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("Failed to delete user data:", error);
  process.exit(1);
});