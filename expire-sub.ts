import { MongoClient } from "mongodb";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const MONGODB_URL = process.env.MONGODB_URL as string;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME as string;

if (!MONGODB_URL || !MONGODB_DB_NAME) {
  throw new Error("Missing MongoDB connection string or DB name in .env.local");
}

async function expireSubscription() {
  const client = new MongoClient(MONGODB_URL);
  try {
    await client.connect();
    const db = client.db(MONGODB_DB_NAME);
    const user = await db.collection("users").findOne({ email: "test@example.com" });
    
    if (!user) {
      console.log("User not found");
      return;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const result = await db.collection("subscriptions").updateOne(
      { user_id: user._id, status: "active" },
      { $set: { status: "payment_expire", expiry_date: yesterday } }
    );
    console.log("Expired subscription, modified:", result.modifiedCount);
  } finally {
    await client.close();
  }
}

expireSubscription();
