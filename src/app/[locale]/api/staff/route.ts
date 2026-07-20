import { NextResponse } from "next/server";
import { getCollection, COLLECTIONS, toObjectId } from "@/lib/db/mongodb";
import { getCurrentUser } from "@/lib/auth/utils";
import bcrypt from "bcryptjs";

export async function GET(req: Request) {
  try {
    let user;
    try {
      user = await getCurrentUser();
    } catch (e) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ownerId = user.id;
    
    // Only owners or staff with specific permission should manage staff
    const userRole = user.role;
    if (userRole === "staff") {
      const permissions = user.permissions || [];
      if (!permissions.includes("*") && !permissions.includes("settings.view")) {
        // return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const usersCollection = await getCollection(COLLECTIONS.USERS);
    // Find all staff under this owner
    const staff = await usersCollection.find({ owner_id: toObjectId(ownerId), role: "staff", isDeleted: { $ne: true } }, { projection: { password_hash: 0 } }).toArray();

    // Attach roles to staff members
    const userRolesColl = await getCollection(COLLECTIONS.USER_ROLES);
    const rolesColl = await getCollection(COLLECTIONS.ROLES);

    const staffIds = staff.map(s => s._id);
    const userRoles = await userRolesColl.find({ user_id: { $in: staffIds } }).toArray();
    const roleIds = userRoles.map(ur => ur.role_id);
    const roles = await rolesColl.find({ _id: { $in: roleIds } }).toArray();

    const staffWithRoles = staff.map(s => {
      const myUserRole = userRoles.find(ur => ur.user_id.toString() === s._id.toString());
      const roleObj = myUserRole ? roles.find(r => r._id.toString() === myUserRole.role_id.toString()) : null;
      return {
        ...s,
        role_id: myUserRole?.role_id || null,
        role_name: roleObj?.name || null
      };
    });

    return NextResponse.json(staffWithRoles);
  } catch (error) {
    console.error("Error fetching staff:", error);
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
    const { name, email, password, role_id } = body;

    if (!name || !email || !password || !role_id) {
      return NextResponse.json({ error: "Name, email, password, and role are required" }, { status: 400 });
    }

    const usersCollection = await getCollection(COLLECTIONS.USERS);
    
    // Check if email already exists
    const existingUser = await usersCollection.findOne({ email: email.toLowerCase() });
    if (existingUser && !existingUser.isDeleted) {
      return NextResponse.json({ error: "Email already in use" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await usersCollection.insertOne({
      name,
      email: email.toLowerCase(),
      password_hash: passwordHash,
      role: "staff",
      owner_id: toObjectId(ownerId),
      created_at: new Date(),
      updated_at: new Date(),
    });

    const staffId = result.insertedId;

    // Assign role
    const userRolesColl = await getCollection(COLLECTIONS.USER_ROLES);
    await userRolesColl.insertOne({
      user_id: staffId,
      role_id: toObjectId(role_id)
    });

    return NextResponse.json({ success: true, id: staffId });
  } catch (error) {
    console.error("Error creating staff:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
