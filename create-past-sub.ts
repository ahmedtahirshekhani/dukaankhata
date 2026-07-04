import { MongoClient } from "mongodb";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const MONGODB_URL = process.env.MONGODB_URL as string;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME as string;
const NEXT_PUBLIC_PLAN_NAME = process.env.NEXT_PUBLIC_PLAN_NAME || "pro";
const NEXT_PUBLIC_PLAN_PRICE = parseInt(process.env.NEXT_PUBLIC_PLAN_PRICE || "1000", 10);

if (!MONGODB_URL || !MONGODB_DB_NAME) {
  throw new Error("MONGODB_URL or DB_NAME is missing in .env.local");
}

async function createPastSubscription() {
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

    // Deactivate any existing subscriptions first to clean up
    await subscriptionsCollection.updateMany(
      { user_id: user._id },
      { $set: { status: "expired" } }
    );

    // Create a subscription from 2 months ago that expired 1 month ago
    const oldDate = new Date();
    oldDate.setMonth(oldDate.getMonth() - 2);
    
    const oldExpiryDate = new Date();
    oldExpiryDate.setMonth(oldExpiryDate.getMonth() - 1);

    const oldSubscription = {
      user_id: user._id,
      email: user.email,
      plan: NEXT_PUBLIC_PLAN_NAME.toLowerCase(),
      status: "expired",
      amount: NEXT_PUBLIC_PLAN_PRICE,
      created_at: oldDate,
      expiry_date: oldExpiryDate,
      activated_date: oldDate,
      billing_cycle_start: oldDate,
      billing_cycle_end: oldExpiryDate,
      next_billing_date: oldExpiryDate,
      updated_at: oldExpiryDate,
    };

    const oldResult = await subscriptionsCollection.insertOne(oldSubscription);
    console.log(`Created old completed subscription with ID: ${oldResult.insertedId}`);

    // Create a subscription from 1 month ago that just expired yesterday (so it's in grace period)
    const recentDate = new Date();
    recentDate.setMonth(recentDate.getMonth() - 1);
    
    const recentExpiryDate = new Date();
    recentExpiryDate.setDate(recentExpiryDate.getDate() - 1); // expired yesterday

    const recentSubscription = {
      user_id: user._id,
      email: user.email,
      plan: NEXT_PUBLIC_PLAN_NAME.toLowerCase(),
      status: "payment_expire",
      amount: NEXT_PUBLIC_PLAN_PRICE,
      created_at: recentDate,
      expiry_date: recentExpiryDate,
      activated_date: recentDate,
      billing_cycle_start: recentDate,
      billing_cycle_end: recentExpiryDate,
      next_billing_date: recentExpiryDate,
      previous_subscription_id: oldResult.insertedId,
      is_renewal: true,
      updated_at: recentExpiryDate,
    };

    const recentResult = await subscriptionsCollection.insertOne(recentSubscription);
    console.log(`Created recently expired subscription (grace period) with ID: ${recentResult.insertedId}`);
    
  } catch (error) {
    console.error("Error creating subscription:", error);
  } finally {
    await client.close();
  }
}

createPastSubscription();
