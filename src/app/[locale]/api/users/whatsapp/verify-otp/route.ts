import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getCollection, COLLECTIONS, toObjectId, setLastUpdated } from "@/lib/db/mongodb";
import { auth } from "@/auth";

function hashOtp(otp: string) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const whatsapp_number = typeof body?.whatsapp_number === "string" ? body.whatsapp_number.trim() : "";
    const otp = typeof body?.otp === "string" ? body.otp.trim() : "";

    if (!whatsapp_number || !otp) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const userId = (session.user as any).id as string;
    const codesCollection = await getCollection(COLLECTIONS.WHATSAPP_VERIFICATION_CODES);
    const record = await codesCollection.findOne({ 
      user_id: toObjectId(userId), 
      whatsapp_number 
    });

    if (!record) {
      return NextResponse.json(
        { error: "OTP not found. Please request a new code." },
        { status: 400 }
      );
    }

    // Check expiry
    if (record.expires_at && new Date(record.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "OTP has expired. Please request a new code." },
        { status: 400 }
      );
    }

    // Check attempt limit (e.g. max 5 attempts)
    if (record.attempts >= 5) {
      return NextResponse.json(
        { error: "Too many failed attempts. Please request a new code." },
        { status: 400 }
      );
    }

    const isValid = record.code_hash === hashOtp(otp);

    if (!isValid) {
      await codesCollection.updateOne(
        { _id: record._id },
        {
          $inc: { attempts: 1 },
          $set: { updated_at: new Date() }
        }
      );
      return NextResponse.json({ error: "Invalid OTP code" }, { status: 400 });
    }

    // Valid OTP - update the user's document in the users collection
    const usersCollection = await getCollection(COLLECTIONS.USERS);
    
    await setLastUpdated(
      usersCollection,
      { _id: toObjectId(userId) },
      { whatsapp_number }
    );

    // Delete the verification record as it has been used
    await codesCollection.deleteOne({ _id: record._id });

    console.log(`User ${userId} successfully verified and saved WhatsApp number: ${whatsapp_number}`);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("WhatsApp verify-otp error:", error);
    return NextResponse.json(
      { error: error?.message || "Server error occurred during verification" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
