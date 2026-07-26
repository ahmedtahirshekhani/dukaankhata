import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const MONGODB_URL = process.env.MONGODB_URL;
const DB_NAME = process.env.MONGODB_DB_NAME || "dukaankhata";

if (!MONGODB_URL) {
  console.error("Please provide MONGODB_URL in .env.local");
  process.exit(1);
}

async function migrateShops() {
  console.log("Starting Shops Migration...");
  const client = new MongoClient(MONGODB_URL as string);

  try {
    await client.connect();
    console.log("Connected to MongoDB.");
    const db = client.db(DB_NAME);

    const usersColl = db.collection("users");
    const shopsColl = db.collection("shops");

    // Fetch all users who have a company_name (legacy owners)
    const owners = await usersColl.find({ company_name: { $exists: true, $ne: "" } }).toArray();
    console.log(`Found ${owners.length} users with a company_name.`);

    let createdCount = 0;
    let skippedCount = 0;

    for (const owner of owners) {
      // Check if a shop already exists for this user with the EXACT SAME ID
      const existingShop = await shopsColl.findOne({ _id: owner._id });

      if (existingShop) {
        skippedCount++;
        continue;
      }

      // Create the new shop document using the user's _id as the shop's _id
      // This ensures all legacy products, customers, and roles pointing to owner_id = user._id
      // will now perfectly map to this shop document.
      await shopsColl.insertOne({
        _id: owner._id,
        name: owner.company_name,
        owner_user_id: owner._id,
        created_at: owner.created_at || new Date(),
        updated_at: new Date()
      });

      console.log(`Created shop for user: ${owner.email} (${owner.company_name})`);
      createdCount++;
    }

    console.log(`Migration Complete.`);
    console.log(`- Created Shops: ${createdCount}`);
    console.log(`- Skipped (Already existed): ${skippedCount}`);

  } catch (error) {
    console.error("Error during migration:", error);
  } finally {
    await client.close();
    console.log("Database connection closed.");
  }
}

migrateShops();
