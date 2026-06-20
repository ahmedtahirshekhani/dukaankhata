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
  return NextResponse.json({ error: "Method not allowed. Use verify-otp endpoint." }, { status: 405 });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
