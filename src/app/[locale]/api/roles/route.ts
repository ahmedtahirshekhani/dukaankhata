import { NextResponse } from "next/server";
import { getCollection, COLLECTIONS, toObjectId } from "@/lib/db/mongodb";
import { getCurrentUser } from "@/lib/auth/utils";
import { requirePermission } from "@/lib/auth/rbac";

export async function GET(req: Request) {
  try {
    let user;
    try {
      user = await getCurrentUser();
    } catch (e) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ownerId = (user as any).active_workspace_id || user.id;

    const authCheck = await requirePermission("staff.view");
    if (!authCheck.allowed) return authCheck.response!;

    const rolesCollection = await getCollection(COLLECTIONS.ROLES);
    const roles = await rolesCollection.find(
      { owner_id: toObjectId(ownerId) },
      { projection: { name: 1, description: 1, is_system: 1, created_at: 1 } }
    ).toArray();

    if (roles.length === 0) {
      return NextResponse.json([]);
    }

    // Fetch permissions in parallel
    const rolePermissionsColl = await getCollection(COLLECTIONS.ROLE_PERMISSIONS);
    const permsColl = await getCollection(COLLECTIONS.PERMISSIONS);

    const roleIds = roles.map(r => r._id);
    const [rolePerms, allPerms] = await Promise.all([
      rolePermissionsColl.find(
        { role_id: { $in: roleIds } },
        { projection: { role_id: 1, permission_id: 1 } }
      ).toArray(),
      permsColl.find(
        {},
        { projection: { module_code: 1, action: 1 } }
      ).toArray()
    ]);

    const permMap = new Map<string, string>();
    for (const p of allPerms) {
      permMap.set(p._id.toString(), `${p.module_code}.${p.action}`);
    }

    const rolePermsMap = new Map<string, string[]>();
    for (const rp of rolePerms) {
      const rId = rp.role_id.toString();
      const pStr = permMap.get(rp.permission_id.toString());
      if (pStr) {
        if (!rolePermsMap.has(rId)) {
          rolePermsMap.set(rId, []);
        }
        rolePermsMap.get(rId)!.push(pStr);
      }
    }

    const rolesWithPerms = roles.map(role => {
      const rId = role._id.toString();
      return {
        ...role,
        id: rId,
        permissions: rolePermsMap.get(rId) || []
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

    const ownerId = (user as any).active_workspace_id || user.id;

    const authCheck = await requirePermission("staff.create");
    if (!authCheck.allowed) return authCheck.response!;
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
