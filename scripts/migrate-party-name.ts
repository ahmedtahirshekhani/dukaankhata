import 'dotenv/config';
import { getCollection, COLLECTIONS } from '../src/lib/db/mongodb';

async function migrate() {
  try {
    console.log('Starting migration: Cash In Hand -> Walk In Customer...');

    const partiesCollection = await getCollection(COLLECTIONS.PARTIES);

    const result = await partiesCollection.updateMany(
      { name: "Cash In Hand" },
      { $set: { name: "Walk In Customer" } }
    );

    console.log('Migration completed successfully!');
    console.log(`- Matched: ${result.matchedCount}`);
    console.log(`- Modified: ${result.modifiedCount}`);

    process.exit(0);
  } catch (error) {
    console.error('Error migrating parties:', error);
    process.exit(1);
  }
}

migrate();
