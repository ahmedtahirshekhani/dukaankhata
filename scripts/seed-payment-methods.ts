import 'dotenv/config';
import { getCollection, COLLECTIONS } from '../src/lib/db/mongodb';

async function migrate() {
  try {
    console.log("Fetching shops...");
    const shopsCollection = await getCollection(COLLECTIONS.SHOPS);
    const pmCollection = await getCollection(COLLECTIONS.PAYMENT_METHOD);

    const shops = await shopsCollection.find({}).toArray();
    console.log(`Found ${shops.length} total shops.`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const shop of shops) {
      const existingCash = await pmCollection.findOne({ 
        user_id: shop._id,
        bank_name: { $regex: /^Cash in Hand$/i }
      });
      
      if (!existingCash) {
        await pmCollection.insertOne({
          user_id: shop._id,
          bank_name: "Cash in Hand",
          bank_details: "Auto-created cash account",
          opening_balance: 0,
          created_at: new Date(),
          updated_at: new Date(),
        });
        migratedCount++;
        console.log(`Created Cash in Hand payment method for shop ID: ${shop._id}`);
      } else {
        skippedCount++;
      }
    }

    console.log("\n--- Migration Summary ---");
    console.log(`Total Shops Processed: ${shops.length}`);
    console.log(`New Payment Methods Created: ${migratedCount}`);
    console.log(`Shops Skipped (already had Cash in Hand): ${skippedCount}`);
    console.log("-------------------------\n");

  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    process.exit(0);
  }
}

migrate();
