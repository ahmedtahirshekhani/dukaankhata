import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS, toObjectId, setLastUpdated, updateUserLastActivity } from "@/lib/db/mongodb";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const users = await getCollection(COLLECTIONS.USERS);
    const userId = (session.user as any).id as string;
    const user = await users.findOne({ _id: toObjectId(userId) });

    return NextResponse.json({ whatsapp_number: user?.whatsapp_number || "" });
  } catch (err: any) {
    console.error("whatsapp number get error", err?.message || err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const whatsapp_number = typeof body?.whatsapp_number === "string" ? body.whatsapp_number.trim() : "";

    if (!whatsapp_number) {
      return NextResponse.json(
        { error: "WhatsApp number is required" },
        { status: 400 },
      );
    }

    const users = await getCollection(COLLECTIONS.USERS);
    const userId = (session.user as any).id as string;

    const update: Record<string, any> = {
      whatsapp_number,
    };

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
    console.error("whatsapp number update error", err?.message || err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
