import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/utils";
import { baileysEngine } from "@/lib/whatsapp/baileys-engine";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const shopId = user.id; // active_workspace_id
    const body = await req.json();
    const { phone, message } = body;

    if (!phone || typeof phone !== "string" || phone.trim() === "") {
      return NextResponse.json({ error: "A valid recipient phone number is required" }, { status: 400 });
    }

    if (!message || typeof message !== "string" || message.trim() === "") {
      return NextResponse.json({ error: "Message text cannot be empty" }, { status: 400 });
    }

    // Call Baileys engine to dispatch message directly from owner's connected session
    const result = await baileysEngine.sendTextMessage(shopId, phone.trim(), message.trim());

    if (result.success) {
      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        message: "Test message sent successfully!"
      });
    } else {
      return NextResponse.json({
        error: result.error || "Failed to send WhatsApp message"
      }, { status: 400 });
    }

  } catch (error: any) {
    console.error("Error sending test WhatsApp message:", error);
    return NextResponse.json({ error: error?.message || "Server Error" }, { status: 500 });
  }
}
