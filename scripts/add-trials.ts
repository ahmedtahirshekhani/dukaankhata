import { MongoClient } from "mongodb";

async function main() {
  const uri = process.env.MONGODB_URL;
  if (!uri) {
    console.error("Missing MONGODB_URL in environment.");
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("Connected to MongoDB.");

    const dbName = process.env.MONGODB_DB_NAME || "dukaankhata";
    const db = client.db(dbName);
    const usersCollection = db.collection("users");
    const subscriptionsCollection = db.collection("subscriptions");

    const users = await usersCollection.find({}).toArray();
    console.log(`Found ${users.length} users in total.`);

    let addedCount = 0;
    let skippedCount = 0;

    const trialDays = parseInt(process.env.NEXT_PUBLIC_TRIAL_NUMBER_OF_DAYS || "14", 10);
    const planPrice = parseInt(process.env.NEXT_PUBLIC_PLAN_PRICE || "1000", 10);
    const planName = process.env.NEXT_PUBLIC_PLAN_NAME || "starter";

    for (const user of users) {
      // Check if user already has any subscription
      const existingSub = await subscriptionsCollection.findOne({ user_id: user._id });

      if (existingSub) {
        skippedCount++;
        continue;
      }

      const now = new Date();
      const expiryDate = new Date();
      expiryDate.setDate(now.getDate() + trialDays);

      await subscriptionsCollection.insertOne({
        user_id: user._id,
        email: user.email,
        plan: "trial", // Trial plan
        status: "in_trial",
        amount: 0,
        trial_days: trialDays,
        created_at: now,
        expiry_date: expiryDate,
        activated_date: now,
        billing_cycle_start: now,
        billing_cycle_end: expiryDate,
        next_billing_date: expiryDate,
      });

      console.log(`Added trial subscription for user: ${user.email}`);
      addedCount++;
    }

    console.log("--- Migration Complete ---");
    console.log(`Users skipped (already had subscription): ${skippedCount}`);
    console.log(`Users granted trial subscription: ${addedCount}`);
  } catch (error) {
    console.error("Migration error:", error);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
