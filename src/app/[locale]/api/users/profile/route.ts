//src/app/[locale]/api/users/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCollection, COLLECTIONS, toObjectId, setLastUpdated, updateUserLastActivity } from "@/lib/db/mongodb";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const company =
      typeof body?.company === "string" ? body.company.trim() : undefined;

    if (!name && company === undefined) {
      return NextResponse.json(
        { error: "At least one field is required" },
        { status: 400 },
      );
    }

    if (body?.name !== undefined && name.length < 1) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }

    const users = await getCollection(COLLECTIONS.USERS);
    // User profile belongs to the real user, not the workspace (shop)
    const userId = (session.user as any).real_user_id as string;

    const update: Record<string, any> = {
      updated_at: new Date(),
    };

    if (name) {
      update.name = name;
    }

    const result = await setLastUpdated(
      users,
      { _id: toObjectId(userId) },
      update
    );


    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await updateUserLastActivity();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("profile update error", err?.message || err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
