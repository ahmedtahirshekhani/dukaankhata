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

    // Fetch all users who have legacy company fields
    const owners = await usersColl.find({
      $or: [
        { company_name: { $exists: true, $ne: "" } },
        { company_address: { $exists: true, $ne: "" } },
        { company_phone: { $exists: true, $ne: "" } },
        { company_email: { $exists: true, $ne: "" } },
        { company_logo: { $exists: true, $ne: null } },
        { signature_image: { $exists: true, $ne: null } }
      ]
    }).toArray();
    console.log(`Found ${owners.length} users with legacy company fields.`);

    let createdCount = 0;
    let updatedCount = 0;
    let garbageClearedCount = 0;

    for (const owner of owners) {
      // Check if a shop already exists for this user with the EXACT SAME ID
      const existingShop = await shopsColl.findOne({ _id: owner._id });

      if (existingShop) {
        // Only update fields that are missing in the shop
        const updates: any = {};
        if (!existingShop.name && owner.company_name) updates.name = owner.company_name;
        if (!existingShop.company_address && owner.company_address) updates.company_address = owner.company_address;
        if (!existingShop.company_phone && owner.company_phone) updates.company_phone = owner.company_phone;
        if (!existingShop.company_email && owner.company_email) updates.company_email = owner.company_email;
        if (!existingShop.company_logo && owner.company_logo) updates.company_logo = owner.company_logo;
        if (!existingShop.signature_image && owner.signature_image) updates.signature_image = owner.signature_image;

        if (Object.keys(updates).length > 0) {
          await shopsColl.updateOne(
            { _id: owner._id },
            { $set: updates }
          );
          updatedCount++;
        }
      } else {
        // Create the new shop document using the user's _id as the shop's _id
        await shopsColl.insertOne({
          _id: owner._id,
          name: owner.company_name || `${owner.name}'s Shop`,
          company_address: owner.company_address || null,
          company_phone: owner.company_phone || null,
          company_email: owner.company_email || null,
          company_logo: owner.company_logo || null,
          signature_image: owner.signature_image || null,
          owner_user_id: owner._id,
          created_at: owner.created_at || new Date(),
          updated_at: new Date()
        });
        createdCount++;
        console.log(`Created shop for user: ${owner.email} (${owner.company_name})`);
      }

      // Garbage Collection: Remove these fields from the user document
      const unsetFields = {
        company_name: "",
        company_address: "",
        company_phone: "",
        company_email: "",
        company_logo: "",
        signature_image: ""
      };

      await usersColl.updateOne(
        { _id: owner._id },
        { $unset: unsetFields }
      );
      garbageClearedCount++;
    }

    console.log(`Migration Complete.`);
    console.log(`- Created Shops: ${createdCount}`);
    console.log(`- Updated Existing Shops: ${updatedCount}`);
    console.log(`- Cleared Garbage from Users: ${garbageClearedCount}`);

  } catch (error) {
    console.error("Error during migration:", error);
  } finally {
    await client.close();
    console.log("Database connection closed.");
  }
}

migrateShops();
