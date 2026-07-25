export {};

const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI as string;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

async function checkData() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db('dukaan-khata-prod');

    console.log("=== Checking RBAC Data ===");

    const roles = await db.collection('roles').find().toArray();
    console.log(`\nFound ${roles.length} Roles:`);
    for (const role of roles) {
      console.log(`- Role: ${role.name} (ID: ${role._id})`);
      
      const rolePerms = await db.collection('role_permissions').find({ role_id: role._id }).toArray();
      console.log(`  -> Has ${rolePerms.length} permissions assigned in 'role_permissions' collection`);
      for (const rp of rolePerms) {
        const perm = await db.collection('permissions').findOne({ _id: rp.permission_id });
        if (perm) {
          console.log(`     * ${perm.module_code}.${perm.action}`);
        }
      }
    }

    console.log("\n=== Checking Staff Users ===");
    const staffUsers = await db.collection('users').find({ role: 'staff' }).toArray();
    console.log(`Found ${staffUsers.length} Staff Users:`);
    for (const staff of staffUsers) {
      console.log(`- Staff: ${staff.name} (Email: ${staff.email}, Owner ID: ${staff.owner_id})`);
      
      const userRole = await db.collection('user_roles').findOne({ user_id: staff._id });
      if (userRole) {
        const role = await db.collection('roles').findOne({ _id: userRole.role_id });
        console.log(`  -> Assigned to Role: ${role ? role.name : 'Unknown'} (via 'user_roles' collection)`);
      } else {
        console.log(`  -> No role assigned yet`);
      }
    }

    const allUsersCount = await db.collection('users').countDocuments();
    console.log(`\nTotal users in 'users' collection (including owners & staff): ${allUsersCount}`);

  } catch (error) {
    console.error('Error checking data:', error);
  } finally {
    await client.close();
  }
}

checkData().catch(console.error);
