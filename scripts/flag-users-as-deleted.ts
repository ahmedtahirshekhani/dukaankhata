import "dotenv/config";
import { MongoClient, ObjectId } from "mongodb";

const MONGODB_URL = process.env.MONGODB_URL;
const DB_NAME = process.env.MONGODB_DB_NAME || "dukaankhata";

const TARGET_USER_IDS = [
  "694d87171bda8cd5322b631c"
];

if (!MONGODB_URL) {
  throw new Error("Missing MONGODB_URL in environment.");
}

function parseArgs() {
  return {
    dryRun: process.argv.includes("--dry-run"),
  };
}

function asObjectIds(ids: string[]): ObjectId[] {
  return ids.map((id) => {
    if (!ObjectId.isValid(id)) {
      throw new Error(`Invalid ObjectId: ${id}`);
    }

    return new ObjectId(id);
  });
}

async function main() {
  const { dryRun } = parseArgs();
  const client = new MongoClient(MONGODB_URL);

  await client.connect();
  console.log("Connected to MongoDB.");

  try {
    const db = client.db(DB_NAME);
    const usersCollection = db.collection("users");
    const targetObjectIds = asObjectIds(TARGET_USER_IDS);

    const matchedCount = await usersCollection.countDocuments({
      _id: { $in: targetObjectIds },
    });

    if (dryRun) {
      const alreadyFlaggedCount = await usersCollection.countDocuments({
        _id: { $in: targetObjectIds },
        isDeleted: true,
      });

      console.log(`Matched ${matchedCount} users.`);
      console.log(`${alreadyFlaggedCount} users already have isDeleted set to true.`);
      console.log("Dry run complete. No documents were updated.");
      return;
    }

    const updateResult = await usersCollection.updateMany(
      { _id: { $in: targetObjectIds } },
      { $set: { isDeleted: true } }
    );

    console.log(`Matched ${updateResult.matchedCount} users.`);
    console.log(`Modified ${updateResult.modifiedCount} users.`);
    console.log("User flag update complete.");
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("Failed to flag users as deleted:", error);
  process.exit(1);
});