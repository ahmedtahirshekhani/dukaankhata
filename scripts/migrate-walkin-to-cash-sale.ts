import 'dotenv/config';
import { getCollection, COLLECTIONS, toObjectId } from '../src/lib/db/mongodb';

async function migrate() {
  try {
    console.log('🚀 Starting comprehensive Cash Sale migration & setup...');

    const partiesCollection = await getCollection(COLLECTIONS.PARTIES);
    const shopsCollection = await getCollection(COLLECTIONS.SHOPS);
    const usersCollection = await getCollection(COLLECTIONS.USERS);

    // 1. Standardize all existing Walk-In, Cash, and Default parties to "Cash Sale"
    const renameResult = await partiesCollection.updateMany(
      {
        $or: [
          { name: { $regex: /^(Walk[ -]?In|Cash|Default)/i } },
          { type: "cash" },
          { is_default: true },
        ],
        is_delete: { $ne: 1 },
      },
      {
        $set: {
          name: "Cash Sale",
          type: "cash",
          is_default: true,
          updated_at: new Date(),
        },
      }
    );

    console.log('✅ Phase 1 - Standardizing Existing Cash/Walk-In Parties:');
    console.log(`  - Matched: ${renameResult.matchedCount}`);
    console.log(`  - Modified: ${renameResult.modifiedCount}`);

    // 2. Collect all shop workspace IDs (from shops collection + users collection)
    const allShops = await shopsCollection.find({}).toArray();
    const allUsers = await usersCollection.find({}).toArray();

    // Map of target shop workspaces: shopIdString -> { shopId: ObjectId, name: string }
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

    console.log(`\n🔍 Phase 2 - Verification & Creation for ${targetShopsMap.size} Shop Workspaces...`);

    let createdCount = 0;
    let updatedCount = 0;
    let existingCount = 0;

    const shopsList = Array.from(targetShopsMap.entries());

    for (const [shopIdStr, shopInfo] of shopsList) {
      const shopObjectId = toObjectId(shopInfo.shopId);

      // Check if this shop already has a "Cash Sale" party
      let existingCashParty = await partiesCollection.findOne({
        $and: [
          {
            $or: [
              { user_id: shopObjectId },
              { user_id: shopIdStr },
              { owner_id: shopObjectId },
              { owner_id: shopIdStr },
            ],
          },
          { name: "Cash Sale" },
          { is_delete: { $ne: 1 } },
        ],
      });

      if (existingCashParty) {
        // Ensure its type and is_default flags are true
        if (!existingCashParty.is_default || existingCashParty.type !== "cash") {
          await partiesCollection.updateOne(
            { _id: existingCashParty._id },
            { $set: { is_default: true, type: "cash", updated_at: new Date() } }
          );
          updatedCount++;
          console.log(`  ~ Updated flags for existing Cash Sale in shop (${shopIdStr}): ${shopInfo.name}`);
        } else {
          existingCount++;
          console.log(`  ✓ Existing Cash Sale verified for shop (${shopIdStr}): ${shopInfo.name}`);
        }
      } else {
        // Check if there is any party with type 'cash' or is_default true to convert
        let defaultCandidate = await partiesCollection.findOne({
          $and: [
            {
              $or: [
                { user_id: shopObjectId },
                { user_id: shopIdStr },
                { owner_id: shopObjectId },
                { owner_id: shopIdStr },
              ],
            },
            {
              $or: [
                { type: "cash" },
                { is_default: true },
              ],
            },
            { is_delete: { $ne: 1 } },
          ],
        });

        if (defaultCandidate) {
          await partiesCollection.updateOne(
            { _id: defaultCandidate._id },
            {
              $set: {
                name: "Cash Sale",
                type: "cash",
                is_default: true,
                updated_at: new Date(),
              },
            }
          );
          updatedCount++;
          console.log(`  ~ Renamed existing default party to Cash Sale for shop (${shopIdStr}): ${shopInfo.name}`);
        } else {
          // Create new Cash Sale party for this shop
          await partiesCollection.insertOne({
            name: "Cash Sale",
            type: "cash",
            user_id: toObjectId(shopInfo.shopId),
            owner_id: toObjectId(shopInfo.shopId),
            company_name: shopInfo.name,
            created_at: new Date(),
            updated_at: new Date(),
            is_default: true,
            description: "Auto-created cash account for this shop.",
            phone: null,
            email: null,
            address: null,
            opening_balance: 0,
            balance: 0,
            status: "active",
          });
          createdCount++;
          console.log(`  + CREATED new Cash Sale party for shop (${shopIdStr}): ${shopInfo.name}`);
        }
      }
    }

    console.log('\n🎉 Comprehensive Setup Completed:');
    console.log(`  - Total Workspaces Checked: ${targetShopsMap.size}`);
    console.log(`  - Already Correct: ${existingCount}`);
    console.log(`  - Standardized/Renamed: ${updatedCount}`);
    console.log(`  - Brand New Created: ${createdCount}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error during migration:', error);
    process.exit(1);
  }
}

migrate();
