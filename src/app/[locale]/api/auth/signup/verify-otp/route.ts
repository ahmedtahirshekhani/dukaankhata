import { NextResponse } from "next/server";
import crypto from "crypto";
import { getCollection, COLLECTIONS } from "@/lib/db/mongodb";

function hashOtp(otp: string) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const otp = String(body?.otp || "").trim();

    if (!email || !otp) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const codesCollection = await getCollection(COLLECTIONS.EMAIL_VERIFICATION_CODES);
    const record = await codesCollection.findOne({ email });

    if (!record) {
      return NextResponse.json({ error: "OTP not found. Please request a new one." }, { status: 400 });
    }

    if (record.expires_at && new Date(record.expires_at) < new Date()) {
      return NextResponse.json({ error: "OTP has expired. Please request a new one." }, { status: 400 });
    }

    if (record.verified) {
      return NextResponse.json({ ok: true, verified: true });
    }

    const isValid = record.code_hash === hashOtp(otp);

    if (!isValid) {
      await codesCollection.updateOne(
        { email },
        {
          $inc: { attempts: 1 },
          $set: { updated_at: new Date() },
        },
      );

      return NextResponse.json({ error: "Invalid OTP. Please try again." }, { status: 400 });
    }

    await codesCollection.updateOne(
      { email },
      {
        $set: {
          verified: true,
          verified_at: new Date(),
          updated_at: new Date(),
        },
      },
    );

    return NextResponse.json({ ok: true, verified: true });
  } catch (error) {
    console.error("signup verify-otp error:", error);
    return NextResponse.json(
      { error: "Failed to verify OTP. Please try again." },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";