import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { getCollection, COLLECTIONS, toObjectId } from "../src/lib/db/mongodb";

async function migrateConfigurations() {
  try {
    console.log("🚀 Starting comprehensive Configuration migration (Workspaces & Users)...");

    const configsCollection = await getCollection(COLLECTIONS.CONFIGURATIONS);
    const shopsCollection = await getCollection(COLLECTIONS.SHOPS);
    const usersCollection = await getCollection(COLLECTIONS.USERS);

    // 1. Collect all shop workspace IDs (from shops collection + users collection)
    const allShops = await shopsCollection.find({}).toArray();
    const allUsers = await usersCollection.find({}).toArray();

    // Map of target shop workspaces: shopIdString -> { shopId: any, name: string }
    const targetShopsMap = new Map<string, { shopId: any; name: string }>();

    for (const shop of allShops) {
      if (shop._id) {
        targetShopsMap.set(shop._id.toString(), {
          shopId: shop._id,
          name: shop.name || "Shop",
        });
      }
    }

    for (const user of allUsers) {
      if (user._id && !targetShopsMap.has(user._id.toString())) {
        targetShopsMap.set(user._id.toString(), {
          shopId: user._id,
          name: user.company_name || user.name || "Shop",
        });
      }
    }

    console.log(`\n🔍 Verifying & Creating Configurations for ${targetShopsMap.size} Shop Workspaces...`);

    let createdCount = 0;
    let updatedCount = 0;
    let untouchedCount = 0;

    const shopsList = Array.from(targetShopsMap.entries());

    for (const [shopIdStr, shopInfo] of shopsList) {
      const shopObjectId = toObjectId(shopInfo.shopId);

      // Check if this workspace already has a configuration document
      let existingConfig = await configsCollection.findOne({
        $or: [
          { user_id: shopObjectId },
          { user_id: shopIdStr },
        ],
      });

      if (existingConfig) {
        // Prepare any missing fields for backward compatibility
        const updateFields: any = {};

        if (!existingConfig.stock_valuation_method) {
          updateFields.stock_valuation_method = "average";
        }
        if (typeof existingConfig.is_counterSale_enable !== "boolean") {
          updateFields.is_counterSale_enable = false;
        }
        if (typeof existingConfig.is_AI_Chat_Enable !== "boolean") {
          updateFields.is_AI_Chat_Enable = true;
        }
        if (typeof existingConfig.is_Whatsapp_enable !== "boolean") {
          updateFields.is_Whatsapp_enable = false;
        }
        // Normalize user_id to ObjectId if it was stored as string
        if (typeof existingConfig.user_id === "string") {
          updateFields.user_id = shopObjectId;
        }

        if (Object.keys(updateFields).length > 0) {
          updateFields.updated_at = new Date();
          await configsCollection.updateOne(
            { _id: existingConfig._id },
            { $set: updateFields }
          );
          updatedCount++;
          console.log(`  ~ Updated missing fields for workspace (${shopIdStr}): ${shopInfo.name}`);
        } else {
          untouchedCount++;
          console.log(`  ✓ Configuration verified for workspace (${shopIdStr}): ${shopInfo.name}`);
        }
      } else {
        // Create new configuration for this shop workspace
        await configsCollection.insertOne({
          user_id: shopObjectId,
          is_counterSale_enable: false,
          is_AI_Chat_Enable: true,
          is_Whatsapp_enable: false,
          stock_valuation_method: "average",
          created_at: new Date(),
          updated_at: new Date(),
        });
        createdCount++;
        console.log(`  + CREATED new Configuration for workspace (${shopIdStr}): ${shopInfo.name}`);
      }
    }

    // Phase 2: Sweep through any other existing configurations in DB and ensure stock_valuation_method is present
    const sweepResult = await configsCollection.updateMany(
      {
        $or: [
          { stock_valuation_method: { $exists: false } },
          { stock_valuation_method: null },
          { stock_valuation_method: "" },
        ],
      },
      {
        $set: {
          stock_valuation_method: "average",
          updated_at: new Date(),
        },
      }
    );

    console.log("\n🎉 Comprehensive Configuration Migration Completed:");
    console.log(`  - Total Workspaces Checked: ${targetShopsMap.size}`);
    console.log(`  - Already Up-to-Date: ${untouchedCount}`);
    console.log(`  - Updated Missing Fields: ${updatedCount}`);
    console.log(`  - Newly Created Configurations: ${createdCount}`);
    console.log(`  - General Sweep Fallback Updates: ${sweepResult.modifiedCount}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrateConfigurations();
