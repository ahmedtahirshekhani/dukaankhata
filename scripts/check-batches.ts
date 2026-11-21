import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { getCollection, COLLECTIONS } from "../src/lib/db/mongodb";

async function check() {
  const products = await getCollection(COLLECTIONS.PRODUCTS);
  const batches = await getCollection(COLLECTIONS.INVENTORY_BATCHES);

  const lastProducts = await products.find({}).sort({ created_at: -1 }).limit(3).toArray();
  console.log("LAST 3 PRODUCTS IN MONGODB:");
  console.log(JSON.stringify(lastProducts, null, 2));

  const allBatches = await batches.find({}).sort({ created_at: -1 }).limit(5).toArray();
  console.log("LAST 5 BATCHES IN MONGODB:");
  console.log(JSON.stringify(allBatches, null, 2));

  process.exit(0);
}

check().catch(console.error);
