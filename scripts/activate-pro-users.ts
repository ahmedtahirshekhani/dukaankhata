import { MongoClient, ObjectId } from "mongodb";

// Add user IDs to upgrade to pro plan
const USER_IDS: string[] = [
  "6a2f9d5253ad6f11890c369b",
  // "60d5ecb8b3924e0017b4f456",
];

async function main() {
  if (USER_IDS.length === 0) {
    console.error("No user IDs provided. Add user IDs to the USER_IDS array.");
    process.exit(1);
  }

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

    const proDays = parseInt(process.env.PRO_PLAN_DAYS || "30", 10);

    let updatedCount = 0;
    let createdCount = 0;
    let notFoundCount = 0;

    for (const userId of USER_IDS) {
      let userObjectId: ObjectId;
      try {
        userObjectId = new ObjectId(userId);
      } catch {
        console.error(`Invalid ObjectId: ${userId}, skipping.`);
        continue;
      }

      const user = await usersCollection.findOne({ _id: userObjectId });
      if (!user) {
        console.warn(`User not found: ${userId}`);
        notFoundCount++;
        continue;
      }

      const now = new Date();
      const expiryDate = new Date();
      expiryDate.setDate(now.getDate() + proDays);

      const existingSub = await subscriptionsCollection.findOne({ user_id: userObjectId });

      if (existingSub) {
        await subscriptionsCollection.updateOne(
          { _id: existingSub._id },
          {
            $set: {
              plan: "pro",
              status: "active",
              activated_date: now,
              billing_cycle_start: now,
              billing_cycle_end: expiryDate,
              next_billing_date: expiryDate,
              expiry_date: expiryDate,
              updated_at: now,
            },
          }
        );
        console.log(`Updated existing subscription to pro for user: ${user.email} (${userId})`);
        updatedCount++;
      } else {
        await subscriptionsCollection.insertOne({
          user_id: userObjectId,
          email: user.email,
          plan: "pro",
          status: "active",
          amount: 1000,
          created_at: now,
          activated_date: now,
          billing_cycle_start: now,
          billing_cycle_end: expiryDate,
          next_billing_date: expiryDate,
          expiry_date: expiryDate,
        });
        console.log(`Created new pro subscription for user: ${user.email} (${userId})`);
        createdCount++;
      }
    }

    console.log("--- Complete ---");
    console.log(`Subscriptions updated: ${updatedCount}`);
    console.log(`Subscriptions created: ${createdCount}`);
    console.log(`Users not found: ${notFoundCount}`);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
