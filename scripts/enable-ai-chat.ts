export {};

const { MongoClient } = require('mongodb');

// Get URI from .env.local or use default
require('dotenv').config({ path: '.env.local' });

const uri = process.env.MONGODB_URL ;
const dbName = process.env.MONGODB_DB_NAME;

async function main() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("Connected successfully to MongoDB.");
    
    const db = client.db(dbName);
    const collection = db.collection('configurations');
    
    // Update ALL configurations, including ones where is_AI_Chat_Enable was
    // explicitly false — an { $ne: false } filter would have skipped those.
    const result = await collection.updateMany(
      {},
      { $set: { is_AI_Chat_Enable: true } }
    );

    console.log(`✅ Success!`);
    console.log(`Matched ${result.matchedCount} users.`);
    console.log(`Updated ${result.modifiedCount} users.`);
    console.log(`AI Chat is now enabled for ALL users! 🎉`);
  } catch (error) {
    console.error("Error updating configurations:", error);
  } finally {
    await client.close();
  }
}

main();
