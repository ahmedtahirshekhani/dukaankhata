import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { getCollection, COLLECTIONS } from '../src/lib/db/mongodb';

async function migrateSettingsToConfiguration() {
  try {
    console.log('Starting migration from "settings" to "configuration"...');

    // 1. Update any existing role permissions to use 'configuration' instead of 'settings'
    const rolePermissionsCollection = await getCollection(COLLECTIONS.ROLE_PERMISSIONS);
    const updateResult = await rolePermissionsCollection.updateMany(
      { module_code: 'settings' },
      { $set: { module_code: 'configuration' } }
    );
    console.log(`Updated ${updateResult.modifiedCount} role permissions from "settings" to "configuration".`);

    // 2. Remove orphaned "settings" from modules collection
    const modulesCollection = await getCollection(COLLECTIONS.MODULES);
    const deleteModulesResult = await modulesCollection.deleteMany({ code: 'settings' });
    console.log(`Deleted ${deleteModulesResult.deletedCount} "settings" module records.`);

    // 3. Remove orphaned "settings" from permissions collection
    const permissionsCollection = await getCollection(COLLECTIONS.PERMISSIONS);
    const deletePermissionsResult = await permissionsCollection.deleteMany({ module_code: 'settings' });
    console.log(`Deleted ${deletePermissionsResult.deletedCount} "settings" permission records.`);

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateSettingsToConfiguration();
