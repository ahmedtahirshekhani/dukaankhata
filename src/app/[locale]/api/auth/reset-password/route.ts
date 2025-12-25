import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { getCollection, COLLECTIONS } from "@/lib/mongodb";

function parseAndVerifyToken(token: string) {
  const secret = process.env.RESET_TOKEN_SECRET || "dev-secret-change-me";
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split("|");
    if (parts.length !== 3) throw new Error("Malformed token");

    const [email, expStr, hmacProvided] = parts;
    const payload = `${email}|${expStr}`;

    const hmacCalculated = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    // Timing-safe compare
    const a = Buffer.from(hmacCalculated);
    const b = Buffer.from(hmacProvided);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new Error("Invalid signature");
    }

    const exp = Number(expStr);
    if (!Number.isFinite(exp) || Date.now() > exp) {
      throw new Error("Token expired");
    }

    return { email };
  } catch (e) {
    throw new Error("Invalid or expired token");
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const { email } = parseAndVerifyToken(token);
    return NextResponse.json({ ok: true, email });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Invalid or expired token" },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token: string | undefined = body?.token;
    const password: string | undefined = body?.password;

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }
    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Missing password" }, { status: 400 });
    }

    // Basic password validation
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const { email } = parseAndVerifyToken(token);

    // Hash and update password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const usersCollection = await getCollection(COLLECTIONS.USERS);
    const result = await usersCollection.updateOne(
      { email },
      { 
        $set: { 
          password_hash: passwordHash, 
          updated_at: new Date() 
        } 
      }
    );

    if (result.matchedCount === 0) {
      console.error("reset-password update error: User not found");
      return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("reset-password error", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "Invalid or expired token" },
      { status: 400 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
