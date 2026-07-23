import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

// Load env variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
  const uri = process.env.MONGODB_URL;
  if (!uri) {
    console.error("No MONGODB_URL found in .env.local");
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || "dukaankhata");
    const usersColl = db.collection('users');

    const result = await usersColl.updateMany(
      { email: { $regex: new RegExp('^shoaibstore@gmail\\.com$', 'i') } },
      { $set: { isDeleted: false, deleted_at: null, is_delete: false } }
    );
    console.log(`Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
  } catch (error) {
    console.error("Error updating user:", error);
  } finally {
    await client.close();
  }
}

run();
