import { MongoClient } from "mongodb";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const MONGODB_URL = process.env.MONGODB_URL as string;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME as string;

if (!MONGODB_URL || !MONGODB_DB_NAME) {
  throw new Error("Missing MongoDB connection string or DB name in .env.local");
}

async function createSubscription() {
  const client = new MongoClient(MONGODB_URL);

  try {
    await client.connect();
    const db = client.db(MONGODB_DB_NAME);
    const usersCollection = db.collection("users");
    const subscriptionsCollection = db.collection("subscriptions");

    const email = "test@example.com";
    const user = await usersCollection.findOne({ email });

    if (!user) {
      console.log(`User with email ${email} not found.`);
      return;
    }

    const now = new Date();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30); // 30 days from now

    // First deactivate any existing subscriptions
    await subscriptionsCollection.updateMany(
      { user_id: user._id, status: "active" },
      { $set: { status: "expired" } }
    );

    const subscription = {
      user_id: user._id,
      email: user.email,
      plan: "pro", // NEXT_PUBLIC_PLAN_NAME is PRO but usually we store as lowercase
      status: "active",
      amount: 1000,
      created_at: now,
      expiry_date: expiryDate,
      activated_date: now,
      billing_cycle_start: now,
      billing_cycle_end: expiryDate,
      next_billing_date: expiryDate,
      updated_at: now,
    };

    const result = await subscriptionsCollection.insertOne(subscription);
    console.log(`Created new 30-day PRO subscription for ${email} with ID: ${result.insertedId}`);
  } catch (error) {
    console.error("Error creating subscription:", error);
  } finally {
    await client.close();
  }
}

createSubscription();
