import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const uri = process.env.MONGODB_URL;
const dbName = process.env.MONGODB_DB_NAME || "dukaankhata";

if (!uri) {
  console.error("Error: MONGODB_URL is missing in .env.local");
  process.exit(1);
}

async function migrate() {
  console.log("Connecting to MongoDB...");
  const client = new MongoClient(uri!);

  try {
    await client.connect();
    console.log("Connected to MongoDB.");

    const db = client.db(dbName);
    const usersCollection = db.collection("users");
    const configsCollection = db.collection("configurations");

    console.log("Fetching users...");
    const users = await usersCollection.find({}).toArray();
    console.log(`Found ${users.length} total users.`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      const existingConfig = await configsCollection.findOne({ user_id: user._id });
      
      if (!existingConfig) {
        await configsCollection.insertOne({
          user_id: user._id,
          is_counterSale_enable: false,
          is_AI_Chat_Enable: false,
          is_Whatsapp_enable: false,
          created_at: new Date(),
          updated_at: new Date(),
        });
        migratedCount++;
        console.log(`Created config for user: ${user.email || user._id}`);
      } else {
        skippedCount++;
      }
    }

    console.log("\n--- Migration Summary ---");
    console.log(`Total Users Processed: ${users.length}`);
    console.log(`New Configs Created: ${migratedCount}`);
    console.log(`Users Skipped (already had config): ${skippedCount}`);
    console.log("-------------------------\n");

  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await client.close();
    console.log("Database connection closed.");
  }
}

migrate();
