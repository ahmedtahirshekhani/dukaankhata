import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/utils";
import { requirePermission } from "@/lib/auth/rbac";
import { getCollection, COLLECTIONS } from "@/lib/db/mongodb";
import { toObjectId } from "@/lib/db/mongodb";
import crypto from "crypto";
import nodemailer from "nodemailer";

const APP_URL = process.env.APP_URL || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const MAIL_FROM = process.env.MAIL_FROM || process.env.MAIL_USER || "no-reply@example.com";
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
      console.error("SMTP attempt failed", { host: MAIL_HOST, port, error: err });
    }
  }

  throw lastError;
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.active_workspace_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const authCheck = await requirePermission("staff.create");
    if (!authCheck.allowed) return authCheck.response!;

    const owner_id = user.active_workspace_id;

    const body = await req.json();
    const { email, role_id } = body;

    if (!email || !role_id) {
      return NextResponse.json({ error: "Email and Role ID are required" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const usersColl = await getCollection(COLLECTIONS.USERS);
    const userRolesColl = await getCollection(COLLECTIONS.USER_ROLES);
    const rolesColl = await getCollection(COLLECTIONS.ROLES);
    const invColl = await getCollection(COLLECTIONS.INVITATIONS);

    // Ensure role belongs to owner
    const roleDoc = await rolesColl.findOne({ _id: toObjectId(role_id), owner_id: toObjectId(owner_id) });
    if (!roleDoc) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Check if user is already a staff in this shop
    const existingUser = await usersColl.findOne({ email });
    if (existingUser) {
      // Find all roles this user has in this shop
      const existingUserRoles = await userRolesColl.find({ user_id: existingUser._id }).toArray();
      if (existingUserRoles.length > 0) {
        const userRoleIds = existingUserRoles.map(ur => ur.role_id);
        const shopRoles = await rolesColl.find({ _id: { $in: userRoleIds }, owner_id: toObjectId(owner_id) }).toArray();
        if (shopRoles.length > 0) {
           return NextResponse.json({ error: "User is already staff in this shop" }, { status: 400 });
        }
      }
    }

    // Generate token
    const token = crypto.randomBytes(32).toString("hex");
    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Insert/Update invitation
    await invColl.updateOne(
      { email, owner_id },
      { $set: { email, role_id: toObjectId(role_id), owner_id: toObjectId(owner_id), token, status: "pending", expires_at } },
      { upsert: true }
    );

    // Send email
    const reqUrl = new URL(req.url);
    const locale = reqUrl.pathname.split('/')[1] || 'en';
    const inviteLink = `${APP_URL}/${locale}/invite?token=${token}`;
    const shopName = user.company || "A shop";

    const mailOptions = {
      from: MAIL_FROM,
      to: email,
      subject: `Invitation to join ${shopName} on Dukan Khata`,
      text: `You have been invited to join ${shopName}. Click the link below to accept:\n\n${inviteLink}\n\nThis link will expire in 24 hours.`,
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>You've been invited!</h2>
          <p>You have been invited to join <strong>${shopName}</strong> on Dukan Khata.</p>
          <p>
            <a href="${inviteLink}" style="display:inline-block; padding:10px 20px; background:#000; color:#fff; text-decoration:none; border-radius:5px;">
              Accept Invitation
            </a>
          </p>
          <p style="color: #666; font-size: 12px;">If the button doesn't work, copy this link: <br/> ${inviteLink}</p>
        </div>
      `,
    };

    console.log("=== INVITATION LINK (For Dev) ===");
    console.log(inviteLink);
    console.log("=================================");

    await sendMailWithFallback(mailOptions);

    return NextResponse.json({ success: true, message: "Invitation sent" });
  } catch (error: any) {
    console.error("Invite API error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
