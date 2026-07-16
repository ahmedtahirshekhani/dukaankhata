import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS } from "@/lib/db/mongodb";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();
    const phone = String(body?.phone || "").trim();

    if (!email && !phone) {
      return NextResponse.json(
        { error: "Missing email or phone parameter" },
        { status: 400 },
      );
    }

    const usersCollection = await getCollection(COLLECTIONS.USERS);

    if (email) {
      const existingUser = await usersCollection.findOne({ email });
      if (existingUser) {
        return NextResponse.json(
          { error: "Email already registered" },
          { status: 400 },
        );
      }
    }

    if (phone) {
      const existingPhone = await usersCollection.findOne({ phone });
      if (existingPhone) {
        return NextResponse.json(
          { error: "Phone number already registered" },
          { status: 400 },
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Check exists error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
