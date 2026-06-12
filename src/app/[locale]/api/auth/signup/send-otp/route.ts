import { NextResponse } from "next/server";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { getCollection, COLLECTIONS } from "@/lib/db/mongodb";

const APP_NAME = "Dukaan Khata";
const APP_URL = process.env.APP_URL || "http://localhost:3000";
const MAIL_FROM = process.env.MAIL_FROM || process.env.MAIL_USER || "";

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

function buildOtp() {
  return String(crypto.randomInt(100000, 999999));
}

function hashOtp(otp: string) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

function getCooldownSeconds() {
  const parsedValue = Number(process.env.NEXT_PUBLIC_OTP_TIME || 30);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 30;
}

function getMailAddress(value: string) {
  const trimmedValue = value.trim();
  const angleMatch = trimmedValue.match(/<([^>]+)>/);
  return (angleMatch?.[1] || trimmedValue).trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const name = String(body?.name || "").trim();
    const companyName = String(body?.companyName || "").trim();
    const phone = String(body?.phone || "").trim();

    if (!email || !name || !companyName || !phone) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const usersCollection = await getCollection(COLLECTIONS.USERS);

    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 });
    }

    const existingCompany = await usersCollection.findOne({ company_name: companyName });
    if (existingCompany) {
      return NextResponse.json({ error: "Company name already registered" }, { status: 400 });
    }

    const existingPhone = await usersCollection.findOne({ phone });
    if (existingPhone) {
      return NextResponse.json({ error: "Phone number already registered" }, { status: 400 });
    }

    const otp = buildOtp();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const codesCollection = await getCollection(COLLECTIONS.EMAIL_VERIFICATION_CODES);
    await codesCollection.updateOne(
      { email },
      {
        $set: {
          email,
          code_hash: otpHash,
          name,
          company_name: companyName,
          phone,
          verified: false,
          verified_at: null,
          attempts: 0,
          created_at: new Date(),
          updated_at: new Date(),
          expires_at: expiresAt,
        },
      },
      { upsert: true },
    );

    if (!MAIL_USER || !MAIL_PASSWORD) {
      throw new Error("Missing MAIL_USER or MAIL_PASSWORD env values");
    }

    if (!MAIL_FROM) {
      throw new Error("Missing MAIL_FROM env value");
    }

    const fromAddress = getMailAddress(MAIL_FROM);

    const verificationLink = `${APP_URL}/en/signup`;
    const plainText = [
      `${APP_NAME} email verification code`,
      "",
      `Your verification code is: ${otp}`,
      "",
      "This code expires in 10 minutes.",
      "If you did not request this, you can ignore this email.",
      "",
      `Continue on ${verificationLink}`,
    ].join("\n");

    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.6;color:#111827;max-width:560px;">
        <p style="margin:0 0 12px;font-size:14px;color:#6b7280;">${APP_NAME}</p>
        <h2 style="margin:0 0 12px;font-size:24px;line-height:1.2;">Verify your email address</h2>
        <p style="margin:0 0 16px;">Use the code below to continue creating your account.</p>
        <div style="font-size:30px;font-weight:700;letter-spacing:8px;padding:18px 20px;border:1px solid #e5e7eb;border-radius:12px;display:inline-block;margin:0 0 16px;background:#f9fafb;">${otp}</div>
        <p style="margin:0 0 12px;">This code expires in 10 minutes.</p>
        <p style="margin:0 0 12px;">If you did not request this, you can ignore this email.</p>
        <p style="margin:18px 0 0;font-size:12px;color:#6b7280;">Continue on ${verificationLink}</p>
      </div>
    `;

    const result = await sendMailWithFallback({
      from: { name: APP_NAME, address: fromAddress },
      replyTo: fromAddress,
      to: email,
      subject: `${APP_NAME} sign-up code`,
      text: plainText,
      html,
    });

    console.log("Signup OTP sent via Nodemailer to:", email, "on port", result.usedPort);

    return NextResponse.json({ ok: true, cooldownSeconds: getCooldownSeconds() });
  } catch (error) {
    console.error("signup send-otp error:", error);
    return NextResponse.json(
      { error: "Failed to send OTP. Please try again." },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";