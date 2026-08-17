import 'dotenv/config';
import { getCollection, COLLECTIONS } from '../src/lib/db/mongodb';

async function migrate() {
  try {
    console.log('Starting migration: Walk In... -> Cash Sale...');

    const partiesCollection = await getCollection(COLLECTIONS.PARTIES);

    // Regular expression to match anything starting with "Walk In" or "Walk in" or exactly those words
    const result = await partiesCollection.updateMany(
      { name: { $regex: /^Walk[ -]?In/i } },
      { $set: { name: "Cash Sale" } }
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
