//src/app/[locale]/api/auth/forgot-password/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import nodemailer from "nodemailer";

// Assumptions:
// - You have a users collection in MongoDB. We'll query by email to check existence.
// - For demo purposes, we generate a short-lived signed token (HMAC) without persistence.
//   In production, store a hashed token with expiry in DB and verify on reset.

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const MAIL_FROM = process.env.MAIL_FROM || "no-reply@example.com";

const MAIL_HOST = process.env.MAIL_HOST || "smtp.gmail.com";
const MAIL_PORT = Number(process.env.MAIL_PORT || 465);
const MAIL_USER = process.env.MAIL_USER || "";
const MAIL_PASSWORD = (process.env.MAIL_PASSWORD || process.env.MAIL_PASS || "").replace(/\s+/g, "");
const MAIL_TLS_SERVERNAME = process.env.MAIL_TLS_SERVERNAME || "smtp.gmail.com";

function createTransporter(port: number) {
  return nodemailer.createTransport({
    host: MAIL_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: {
      user: MAIL_USER,
      pass: MAIL_PASSWORD,
    },
    tls: {
      servername: MAIL_TLS_SERVERNAME,
      minVersion: "TLSv1.2",
    },
      debug: false,
  logger: false,
  });
}

async function sendMailWithFallback(options: nodemailer.SendMailOptions) {
  const orderedPorts = Array.from(new Set([MAIL_PORT, 465, 587]));
  let lastError: unknown;

  for (const port of orderedPorts) {
    try {
      const transporter = createTransporter(port);
      await transporter.sendMail(options);
      return { usedPort: port };
    } catch (err) {
      lastError = err;
      console.error("SMTP attempt failed", {
        host: MAIL_HOST,
        port,
        error: err,
      });
    }
  }

  throw lastError;
}

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

    // Check if user exists (do not leak info in response). Using MongoDB.
    let userExists = false;
    try {
      const { getCollection, COLLECTIONS } = await import("@/lib/db/mongodb");
      const usersCollection = await getCollection(COLLECTIONS.USERS);
      const user = await usersCollection.findOne({ email });
      if (user) userExists = true;
    } catch (e) {
      // If MongoDB is unavailable, silently continue.
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


      try {
        if (!MAIL_USER || !MAIL_PASSWORD) {
          throw new Error("Missing MAIL_USER or MAIL_PASSWORD env values");
        }

        const result = await sendMailWithFallback({
          from: MAIL_FROM,
          to: email,
          subject: "Reset your password",
          html,
        });
        console.log("Reset email sent via Nodemailer to:", email, "on port", result.usedPort);
      } catch (emailError) {
        console.error("Failed to send email via Nodemailer:", {
          host: MAIL_HOST,
          port: MAIL_PORT,
          hasUser: Boolean(MAIL_USER),
          hasPassword: Boolean(MAIL_PASSWORD),
          tlsServername: MAIL_TLS_SERVERNAME,
          error: emailError,
        });
        throw new Error(`Email send failed: ${emailError}`);
      }
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
