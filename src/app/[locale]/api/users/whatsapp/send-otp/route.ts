import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getCollection, COLLECTIONS, toObjectId } from "@/lib/db/mongodb";
import { auth } from "@/auth";

function buildOtp() {
  return String(crypto.randomInt(100000, 999999));
}

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

    if (!whatsapp_number || whatsapp_number.length !== 11 || !whatsapp_number.startsWith("03")) {
      return NextResponse.json(
        { error: "A valid 11-digit WhatsApp number starting with 03 is required" },
        { status: 400 }
      );
    }

    const userId = (session.user as any).id as string;
    const usersCollection = await getCollection(COLLECTIONS.USERS);
    const user = await usersCollection.findOne({ _id: toObjectId(userId) });
    const userName = user?.name || "User";

    // Format number to +92 format required by Meta API
    const formattedPhone = "+92" + whatsapp_number.slice(1);

    const otp = buildOtp();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Save/Update the OTP code details in our database
    const codesCollection = await getCollection(COLLECTIONS.WHATSAPP_VERIFICATION_CODES);
    await codesCollection.updateOne(
      { user_id: toObjectId(userId), whatsapp_number },
      {
        $set: {
          user_id: toObjectId(userId),
          whatsapp_number,
          code_hash: otpHash,
          attempts: 0,
          created_at: new Date(),
          updated_at: new Date(),
          expires_at: expiresAt,
        },
      },
      { upsert: true }
    );

    const phoneId = process.env.PHONE_ID;
    const bearerToken = process.env.BEARER_TOKEN;

    if (!phoneId || !bearerToken) {
      console.error("WhatsApp configuration missing in env");
      return NextResponse.json(
        { error: "WhatsApp service is not configured on the server." },
        { status: 500 }
      );
    }

    // Call Facebook Meta WhatsApp Graph API
    const metaResponse = await fetch(`https://graph.facebook.com/v25.0/${phoneId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${bearerToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedPhone,
        type: "template",
        template: {
          name: "account_linking_msg",
          language: {
            code: "en_US",
          },
          components: [
            {
              type: "body",
              parameters: [
                {
                  type: "text",
                  parameter_name: "1",
                  text: userName,
                },
                {
                  type: "text",
                  parameter_name: "2",
                  text: otp,
                },
              ],
            },
          ],
        },
      }),
    });

    if (!metaResponse.ok) {
      const errorText = await metaResponse.text();
      console.error("Meta WhatsApp Graph API error response:", errorText);
      return NextResponse.json(
        { error: "Failed to send WhatsApp message. Please check the number or try again." },
        { status: 502 }
      );
    }

    console.log(`WhatsApp OTP successfully sent to user ${userId} at ${formattedPhone}`);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("WhatsApp send-otp error:", error);
    return NextResponse.json(
      { error: error?.message || "Server error occurred while sending OTP" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
