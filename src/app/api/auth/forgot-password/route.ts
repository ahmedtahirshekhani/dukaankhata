import { NextResponse } from "next/server";
import crypto from "crypto";

// Assumptions:
// - You have a users table managed by Supabase. We'll query by email to check existence.
// - For demo purposes, we generate a short-lived signed token (HMAC) without persistence.
//   In production, store a hashed token with expiry in DB and verify on reset.

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const MAIL_FROM = process.env.MAIL_FROM || "no-reply@example.com";

// Nodemailer transport via SMTP envs
// Brevo API configuration
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.MAIL_PASS; // fallback if using SMTP API key in MAIL_PASS
const SENDER_NAME = process.env.MAIL_SENDER_NAME || "DukaanKhata";

// Simple HMAC token builder with 15-min expiry encoded in token
function buildResetToken(email: string) {
  const secret = process.env.RESET_TOKEN_SECRET || "dev-secret-change-me";
  const exp = Date.now() + 15 * 60 * 1000; // 15 minutes
  const payload = `${email}|${exp}`;
  const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const token = Buffer.from(`${payload}|${hmac}`).toString("base64url");
  return token;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email: string | undefined = body?.email;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    // Check format lightly
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Check if user exists (do not leak info in response). Using Supabase server client.
    // If Supabase is unavailable, we proceed with neutral response.
    let userExists = false;
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = createClient();
      const { data, error } = await supabase
        .from("users")
        .select("id")
        .eq("email", email)
        .limit(1)
        .maybeSingle();
      if (!error && data?.id) userExists = true;
    } catch (e) {
      // If server client not available or table different, silently continue.
    }

    if (userExists) {
      const token = buildResetToken(email);
      const resetLink = `${APP_URL}/en/reset-password?token=${token}`;

        const html = `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
          <h2>Password Reset Request</h2>
          <p>If you requested a password reset, click the link below. This link expires in 15 minutes.</p>
          <p><a href="${resetLink}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none">Reset Password</a></p>
          <p>If you didn't request this, you can ignore this email.</p>
        </div>
      `;

        if (!BREVO_API_KEY) {
          throw new Error("Missing BREVO_API_KEY env value");
        }

        const payload = {
          sender: {
            name: SENDER_NAME,
            email: MAIL_FROM.replace(/.*<([^>]+)>.*/, "$1") || MAIL_FROM, // extract email if formatted
          },
          to: [{ email }],
          subject: "Reset your password",
          htmlContent: html,
        };

        const res = await fetch(BREVO_API_URL, {
          method: "POST",
          headers: {
            accept: "application/json",
            "api-key": BREVO_API_KEY,
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Brevo API error: ${res.status} ${errText}`);
        }
      console.log("Brevo reset email queued for:", email);
    }

    // Always return success to avoid user enumeration
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    // Log server-side, but keep neutral client response
    console.error("forgot-password error", err?.message || err);
    return NextResponse.json({ ok: true });
  }
}

// Ensure Node.js runtime on Vercel (not Edge) since Nodemailer requires Node APIs
export const runtime = "nodejs";
// Allow dynamic rendering
export const dynamic = "force-dynamic";
