import { NextResponse } from "next/server";
import { getCollection, COLLECTIONS, toObjectId } from "@/lib/db/mongodb";
import { getCurrentUser } from "@/lib/auth/utils";
import bcrypt from "bcryptjs";
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

    const usersCollection = await getCollection(COLLECTIONS.USERS);
    const userRolesColl = await getCollection(COLLECTIONS.USER_ROLES);
    const rolesColl = await getCollection(COLLECTIONS.ROLES);
    const invColl = await getCollection(COLLECTIONS.INVITATIONS);

    // 1. Fetch shop roles and pending invitations in parallel
    const [shopRoles, pendingInvites] = await Promise.all([
      rolesColl.find(
        { owner_id: toObjectId(ownerId) },
        { projection: { name: 1, permissions: 1 } }
      ).toArray(),
      invColl.find(
        {
          owner_id: toObjectId(ownerId),
          status: "pending",
          expires_at: { $gt: new Date() }
        },
        { projection: { name: 1, email: 1, role_id: 1, token: 1, last_sent_at: 1, created_at: 1 } }
      ).toArray()
    ]);

    const shopRoleIds = shopRoles.map(r => r._id);
    const roleNameMap = new Map(shopRoles.map(r => [r._id.toString(), r.name]));

    // 2. Find user_roles linking users to these shop roles
    const shopUserRoles = shopRoleIds.length > 0
      ? await userRolesColl.find(
          { role_id: { $in: shopRoleIds } },
          { projection: { user_id: 1, role_id: 1 } }
        ).toArray()
      : [];

    const staffIds = shopUserRoles.map(ur => ur.user_id);
    const userToRoleMap = new Map();
    for (const ur of shopUserRoles) {
      userToRoleMap.set(ur.user_id.toString(), ur.role_id.toString());
    }

    // 3. Find the users with lean projection (exclude passwords and internal metadata)
    const staff = await usersCollection.find({
      $or: [
        { _id: { $in: staffIds } },
        { owner_id: toObjectId(ownerId), role: "staff" } // backward compatibility
      ],
      isDeleted: { $ne: true }
    }, {
      projection: { name: 1, email: 1, role: 1, phone: 1, createdAt: 1, created_at: 1 }
    }).toArray();

    const staffWithRoles = staff.map(s => {
      const sId = s._id.toString();
      const rId = userToRoleMap.get(sId) || null;
      const roleName = rId ? roleNameMap.get(rId) || null : null;

      return {
        ...s,
        id: sId,
        role_id: rId,
        role_name: roleName
      };
    });

    const existingEmails = new Set(staff.map(s => s.email?.toLowerCase()));

    const pendingStaff = pendingInvites
      .filter(inv => !existingEmails.has(inv.email?.toLowerCase()))
      .map(inv => {
        const rId = inv.role_id ? inv.role_id.toString() : null;
        const roleName = rId ? roleNameMap.get(rId) || "Staff" : "Staff";
        return {
          _id: inv._id.toString(),
          id: inv._id.toString(),
          name: inv.name || "Pending Invite",
          email: inv.email,
          role: "staff",
          role_id: rId,
          role_name: roleName,
          is_pending: true,
          token: inv.token,
          created_at: inv.last_sent_at || inv.created_at
        };
      });

    return NextResponse.json([...staffWithRoles, ...pendingStaff]);
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

    const ownerId = (user as any).active_workspace_id || user.id;

    const authCheck = await requirePermission("staff.create");
    if (!authCheck.allowed) return authCheck.response!;
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

    if (existingUser) {
      if (!existingUser.isDeleted && password) {
        return NextResponse.json({ error: "User already has an account. Please leave the password field empty to invite them." }, { status: 400 });
      }
      
      staffId = existingUser._id;
      
      if (existingUser.isDeleted) {
         // Restore soft-deleted user
         const updateDoc: any = { isDeleted: false, deleted_at: null, updated_at: new Date(), name };
         if (password) updateDoc.password_hash = await bcrypt.hash(password, 10);
         await usersCollection.updateOne({ _id: staffId }, { $set: updateDoc });
      }
      
      // Check if they already have this exact role
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
