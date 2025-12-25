import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCollection, COLLECTIONS, toObjectId } from "@/lib/mongodb";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const currentPassword: string | undefined = body?.currentPassword;
    const newPassword: string | undefined = body?.newPassword;

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const users = await getCollection(COLLECTIONS.USERS);
    const userId = (session.user as any).id as string;
    const user = await users.findOne({ _id: toObjectId(userId) });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const matches = await bcrypt.compare(currentPassword, user.password_hash);
    if (!matches) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    const result = await users.updateOne(
      { _id: toObjectId(userId) },
      { $set: { password_hash: passwordHash, updated_at: new Date() } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("change-password error", err?.message || err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
