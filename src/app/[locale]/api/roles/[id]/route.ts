import { NextResponse } from "next/server";
import { getCollection, COLLECTIONS, toObjectId } from "@/lib/db/mongodb";
import { getCurrentUser } from "@/lib/auth/utils";
import { requirePermission } from "@/lib/auth/rbac";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    let user;
    try {
      user = await getCurrentUser();
    } catch (e) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ownerId = user.id;

    const authCheck = await requirePermission("staff.edit");
    if (!authCheck.allowed) return authCheck.response!;
    const body = await req.json();
    const { name, permissions } = body;

    const rolesCollection = await getCollection(COLLECTIONS.ROLES);
    const role = await rolesCollection.findOne({ _id: toObjectId(params.id), owner_id: toObjectId(ownerId) });

    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    if (name) {
      await rolesCollection.updateOne({ _id: role._id }, { $set: { name, updated_at: new Date() } });
    }

    if (permissions && Array.isArray(permissions)) {
      const permsColl = await getCollection(COLLECTIONS.PERMISSIONS);
      const rolePermissionsColl = await getCollection(COLLECTIONS.ROLE_PERMISSIONS);

      // First delete existing permissions
      await rolePermissionsColl.deleteMany({ role_id: role._id });

      if (permissions.length > 0) {
        // Find all permission IDs for the requested codes
        const allPerms = await permsColl.find({}).toArray();
        const docsToInsert = permissions.map(permString => {
          const [module_code, action] = permString.split(".");
          const p = allPerms.find(ap => ap.module_code === module_code && ap.action === action);
          if (p) {
            return {
              role_id: role._id,
              permission_id: p._id
            };
          }
          return null;
        }).filter(Boolean);

        if (docsToInsert.length > 0) {
          await rolePermissionsColl.insertMany(docsToInsert as any[]);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating role:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    let user;
    try {
      user = await getCurrentUser();
    } catch (e) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ownerId = user.id;

    const authCheck = await requirePermission("staff.delete");
    if (!authCheck.allowed) return authCheck.response!;

    const rolesCollection = await getCollection(COLLECTIONS.ROLES);
    const result = await rolesCollection.deleteOne({ _id: toObjectId(params.id), owner_id: toObjectId(ownerId) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    // Clean up role permissions
    const rolePermissionsColl = await getCollection(COLLECTIONS.ROLE_PERMISSIONS);
    await rolePermissionsColl.deleteMany({ role_id: toObjectId(params.id) });

    // Clean up user assignments
    const userRolesColl = await getCollection(COLLECTIONS.USER_ROLES);
    await userRolesColl.deleteMany({ role_id: toObjectId(params.id) });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting role:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
