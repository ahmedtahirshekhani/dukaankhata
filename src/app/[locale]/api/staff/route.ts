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
    const userRolesColl = await getCollection(COLLECTIONS.USER_ROLES);
    const rolesColl = await getCollection(COLLECTIONS.ROLES);

    // 1. Get all roles belonging to this shop
    const shopRoles = await rolesColl.find({ owner_id: toObjectId(ownerId) }).toArray();
    const shopRoleIds = shopRoles.map(r => r._id);

    // 2. Find all user_roles linking users to these shop roles
    const shopUserRoles = await userRolesColl.find({ role_id: { $in: shopRoleIds } }).toArray();
    const staffIds = shopUserRoles.map(ur => ur.user_id);

    // 3. Find the users
    const staff = await usersCollection.find({
      $or: [
        { _id: { $in: staffIds } },
        { owner_id: toObjectId(ownerId), role: "staff" } // backward compatibility
      ],
      isDeleted: { $ne: true }
    }, { projection: { password_hash: 0 } }).toArray();

    // Attach roles to staff members
    const allUserIds = staff.map(s => s._id);
    const allUserRoles = await userRolesColl.find({ user_id: { $in: allUserIds } }).toArray();

    const staffWithRoles = staff.map(s => {
      // Find the user_role for THIS specific shop's roles
      const myUserRole = allUserRoles.find(ur => 
        ur.user_id.toString() === s._id.toString() && 
        shopRoleIds.some(rId => rId.toString() === ur.role_id.toString())
      );
      
      const roleObj = myUserRole ? shopRoles.find(r => r._id.toString() === myUserRole.role_id.toString()) : null;
      
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

    if (!name || !email || !role_id) {
      return NextResponse.json({ error: "Name, email, and role are required" }, { status: 400 });
    }

    const usersCollection = await getCollection(COLLECTIONS.USERS);
    const userRolesColl = await getCollection(COLLECTIONS.USER_ROLES);
    
    // Check if email already exists
    const existingUser = await usersCollection.findOne({ email: email.toLowerCase() });
    
    let staffId;

    if (existingUser && !existingUser.isDeleted) {
      if (password) {
        return NextResponse.json({ error: "User already has an account. Please leave the password field empty to invite them." }, { status: 400 });
      }
      staffId = existingUser._id;
      
      // Check if they already have a role in this shop
      // We can check if they already have THIS exact role, or any role from this owner.
      // For now, just add the new user_role mapping. (A user can theoretically have multiple roles in the same shop, but typically it's one).
      // We should check if they already have this exact role to avoid duplicates.
      const existingRole = await userRolesColl.findOne({
        user_id: staffId,
        role_id: toObjectId(role_id)
      });

      if (!existingRole) {
        await userRolesColl.insertOne({
          user_id: staffId,
          role_id: toObjectId(role_id)
        });
      }
    } else {
      if (!password) {
        return NextResponse.json({ error: "Password is required for new users." }, { status: 400 });
      }
      const passwordHash = await bcrypt.hash(password, 10);

      const result = await usersCollection.insertOne({
        name,
        email: email.toLowerCase(),
        password_hash: passwordHash,
        role: "staff", // Legacy field, kept for backwards compatibility
        owner_id: toObjectId(ownerId), // Legacy field, represents the first shop they were created in
        created_at: new Date(),
        updated_at: new Date(),
      });

      staffId = result.insertedId;

      // Assign role
      await userRolesColl.insertOne({
        user_id: staffId,
        role_id: toObjectId(role_id)
      });
    }

    return NextResponse.json({ success: true, id: staffId });
  } catch (error) {
    console.error("Error creating staff:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
