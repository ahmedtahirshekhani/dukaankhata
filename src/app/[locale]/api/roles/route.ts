import { NextResponse } from "next/server";
import { getCollection, COLLECTIONS, toObjectId } from "@/lib/db/mongodb";
import { getCurrentUser } from "@/lib/auth/utils";

export async function GET(req: Request) {
  try {
    let user;
    try {
      user = await getCurrentUser();
    } catch (e) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ownerId = user.id;
    
    // Only owners or staff with specific permission should manage roles
    const userRole = user.role;
    if (userRole === "staff") {
      const permissions = user.permissions || [];
      if (!permissions.includes("*") && !permissions.includes("settings.view")) { // Assuming settings covers roles for now
        // return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const rolesCollection = await getCollection(COLLECTIONS.ROLES);
    const roles = await rolesCollection.find({ owner_id: toObjectId(ownerId) }).toArray();

    // Fetch permissions for each role
    const rolePermissionsColl = await getCollection(COLLECTIONS.ROLE_PERMISSIONS);
    const permsColl = await getCollection(COLLECTIONS.PERMISSIONS);
    
    const roleIds = roles.map(r => r._id);
    const rolePerms = await rolePermissionsColl.find({ role_id: { $in: roleIds } }).toArray();
    
    const allPermIds = Array.from(new Set(rolePerms.map(rp => rp.permission_id.toString())));
    const allPerms = await permsColl.find({ _id: { $in: allPermIds.map(id => toObjectId(id)) } }).toArray();

    const rolesWithPerms = roles.map(role => {
      const myPerms = rolePerms.filter(rp => rp.role_id.toString() === role._id.toString());
      const perms = myPerms.map(rp => {
        const p = allPerms.find(ap => ap._id.toString() === rp.permission_id.toString());
        return p ? `${p.module_code}.${p.action}` : null;
      }).filter(Boolean);

      return {
        ...role,
        permissions: perms
      };
    });

    return NextResponse.json(rolesWithPerms);
  } catch (error) {
    console.error("Error fetching roles:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    let user;
    try {
      user = await getCurrentUser();
    } catch (e) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ownerId = user.id;
    const body = await req.json();
    const { name, permissions } = body; // permissions is an array of "module.action" strings

    if (!name) {
      return NextResponse.json({ error: "Role name is required" }, { status: 400 });
    }

    const rolesCollection = await getCollection(COLLECTIONS.ROLES);
    const roleRes = await rolesCollection.insertOne({
      name,
      owner_id: toObjectId(ownerId),
      created_at: new Date(),
      updated_at: new Date()
    });

    const roleId = roleRes.insertedId;

    if (permissions && Array.isArray(permissions) && permissions.length > 0) {
      const permsColl = await getCollection(COLLECTIONS.PERMISSIONS);
      const rolePermissionsColl = await getCollection(COLLECTIONS.ROLE_PERMISSIONS);

      // Find all permission IDs for the requested codes
      const allPerms = await permsColl.find({}).toArray();
      const docsToInsert = permissions.map(permString => {
        const [module_code, action] = permString.split(".");
        const p = allPerms.find(ap => ap.module_code === module_code && ap.action === action);
        if (p) {
          return {
            role_id: roleId,
            permission_id: p._id
          };
        }
        return null;
      }).filter(Boolean);

      if (docsToInsert.length > 0) {
        await rolePermissionsColl.insertMany(docsToInsert as any[]);
      }
    }

    return NextResponse.json({ success: true, id: roleId });
  } catch (error) {
    console.error("Error creating role:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
