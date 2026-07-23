import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { getCollection, COLLECTIONS } from '../src/lib/db/mongodb';
import fs from 'fs';

async function main() {
  console.log('Fetching users and roles from MongoDB...');
  try {
    const usersColl = await getCollection(COLLECTIONS.USERS);
    const userRolesColl = await getCollection(COLLECTIONS.USER_ROLES);
    const rolesColl = await getCollection(COLLECTIONS.ROLES);

    // Fetch all records
    const users = await usersColl.find({}, { projection: { password_hash: 0 } }).toArray();
    const userRoles = await userRolesColl.find({}).toArray();
    const roles = await rolesColl.find({}).toArray();

    // Group users by email to make it easy to read
    const usersData = users.map(user => {
      // Find all roles assigned to this user
      const assignedRoles = userRoles
        .filter(ur => ur.user_id.toString() === user._id.toString())
        .map(ur => {
          const roleInfo = roles.find(r => r._id.toString() === ur.role_id.toString());
          return {
            role_id: ur.role_id,
            role_name: roleInfo ? roleInfo.name : 'Unknown Role',
            shop_id_of_role: roleInfo ? roleInfo.owner_id : null
          };
        });

      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        original_owner_id: user.owner_id,
        workspaces_count: assignedRoles.length,
        assigned_roles: assignedRoles
      };
    });

    // Find users with multiple workspaces (for highlighting)
    const multiWorkspaceUsers = usersData.filter(u => u.workspaces_count > 1);

    const markdownContent = `
# DukaanKhata Users Data Dump (MongoDB)

Here is the actual data from MongoDB showing how users are linked to multiple shops (workspaces) via the \`user_roles\` collection.

## 🌟 Users with Multiple Workspaces

\`\`\`json
${JSON.stringify(multiWorkspaceUsers, null, 2)}
\`\`\`

## 👥 All Users Overview

\`\`\`json
${JSON.stringify(usersData, null, 2)}
\`\`\`
    `;

    console.log("---- START OF DATA ----");
    console.log(markdownContent);
    console.log("---- END OF DATA ----");
    console.log('Done! Data saved to ' + artifactPath);

  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

main();
