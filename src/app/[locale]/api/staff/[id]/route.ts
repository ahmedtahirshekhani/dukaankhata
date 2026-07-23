import { NextResponse } from "next/server";
import { getCollection, COLLECTIONS, toObjectId } from "@/lib/db/mongodb";
import { getCurrentUser } from "@/lib/auth/utils";
import bcrypt from "bcryptjs";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    let user;
    try {
      user = await getCurrentUser();
    } catch (e) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ownerId = user.id;
    const body = await req.json();
    const { name, email, password, role_id } = body;

    const usersCollection = await getCollection(COLLECTIONS.USERS);
    const staff = await usersCollection.findOne({ _id: toObjectId(params.id), owner_id: toObjectId(ownerId), role: "staff" });

    if (!staff) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    }

    const updateData: any = { updated_at: new Date() };
    if (name) updateData.name = name;
    if (email) {
      // check if email is taken
      if (email.toLowerCase() !== staff.email) {
        const existing = await usersCollection.findOne({ email: email.toLowerCase() });
        if (existing && !existing.isDeleted) {
          return NextResponse.json({ error: "Email already in use" }, { status: 400 });
        }
      }
      updateData.email = email.toLowerCase();
    }
    if (password) {
      updateData.password_hash = await bcrypt.hash(password, 10);
    }

    await usersCollection.updateOne({ _id: staff._id }, { $set: updateData });

    if (role_id) {
      const userRolesColl = await getCollection(COLLECTIONS.USER_ROLES);
      await userRolesColl.updateOne(
        { user_id: staff._id },
        { $set: { role_id: toObjectId(role_id) } },
        { upsert: true }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating staff:", error);
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

    const usersCollection = await getCollection(COLLECTIONS.USERS);
    const userRolesColl = await getCollection(COLLECTIONS.USER_ROLES);
    const rolesColl = await getCollection(COLLECTIONS.ROLES);

    // 1. Delete user_role mappings for this shop
    const shopRoles = await rolesColl.find({ owner_id: toObjectId(ownerId) }).toArray();
    const shopRoleIds = shopRoles.map(r => r._id);

    const deleteRolesResult = await userRolesColl.deleteMany({
      user_id: toObjectId(params.id),
      role_id: { $in: shopRoleIds }
    });

    if (deleteRolesResult.deletedCount === 0) {
      return NextResponse.json({ error: "Staff not found in this shop" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting staff:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
