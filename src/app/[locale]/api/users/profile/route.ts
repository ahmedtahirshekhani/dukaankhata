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

    const { name } = await req.json();
    if (typeof name !== "string" || name.trim().length < 1) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }

    const users = await getCollection(COLLECTIONS.USERS);
    const userId = (session.user as any).id as string;

    const result = await users.updateOne(
      { _id: toObjectId(userId) },
      {
        $set: {
          name: name.trim(),
          updated_at: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("profile update error", err?.message || err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
