import { NextResponse } from "next/server";
import { getCollection, COLLECTIONS } from "@/lib/db/mongodb";
import { getCurrentUser } from "@/lib/auth/utils";
import bcrypt from "bcryptjs";
import { toObjectId } from "@/lib/db/mongodb";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) return NextResponse.json({ error: "Token is required" }, { status: 400 });

    const invColl = await getCollection(COLLECTIONS.INVITATIONS);
    const usersColl = await getCollection(COLLECTIONS.USERS);

    const invite = await invColl.findOne({ token, status: "pending" });
    if (!invite) return NextResponse.json({ error: "Invalid or expired token" }, { status: 404 });

    if (new Date() > new Date(invite.expires_at)) {
      await invColl.updateOne({ _id: invite._id }, { $set: { status: "expired" } });
      return NextResponse.json({ error: "Token expired" }, { status: 400 });
    }

    const existingUser = await usersColl.findOne({ email: invite.email });

    return NextResponse.json({
      email: invite.email,
      userExists: !!existingUser
    });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token, name, password } = body;

    if (!token) return NextResponse.json({ error: "Token is required" }, { status: 400 });

    const invColl = await getCollection(COLLECTIONS.INVITATIONS);
    const usersColl = await getCollection(COLLECTIONS.USERS);
    const userRolesColl = await getCollection(COLLECTIONS.USER_ROLES);

    const invite = await invColl.findOne({ token, status: "pending" });
    if (!invite) return NextResponse.json({ error: "Invalid or expired token" }, { status: 404 });

    if (new Date() > new Date(invite.expires_at)) {
      await invColl.updateOne({ _id: invite._id }, { $set: { status: "expired" } });
      return NextResponse.json({ error: "Token expired" }, { status: 400 });
    }

    let existingUser = await usersColl.findOne({ email: invite.email });
    let userIdToMap = existingUser?._id;

    if (existingUser) {
      // User must be logged in as this user to accept
      const sessionUser = await getCurrentUser();
      if (!sessionUser || sessionUser.email !== invite.email) {
        return NextResponse.json({ error: "You must be logged in as the invited user to accept this invitation." }, { status: 401 });
      }
    } else {
      // New user creation
      if (!name || !password) {
        return NextResponse.json({ error: "Name and password are required for new users." }, { status: 400 });
      }

      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);

      const result = await usersColl.insertOne({
        name,
        email: invite.email,
        password_hash,
        role: "staff", // legacy compat
        status: "active",
        created_at: new Date(),
        updated_at: new Date()
      });

      userIdToMap = result.insertedId;
    }

    // Map role
    await userRolesColl.updateOne(
      { user_id: userIdToMap, role_id: toObjectId(invite.role_id) },
      { $set: { user_id: userIdToMap, role_id: toObjectId(invite.role_id) } },
      { upsert: true }
    );

    // Mark invite as accepted
    await invColl.updateOne({ _id: invite._id }, { $set: { status: "accepted", accepted_at: new Date() } });

    return NextResponse.json({ success: true, message: "Invitation accepted successfully." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
