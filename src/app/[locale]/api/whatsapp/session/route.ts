import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS, toObjectId } from "@/lib/db/mongodb";
import { getCurrentUser } from "@/lib/auth/utils";
import { baileysEngine } from "@/lib/whatsapp/baileys-engine";
import { DEFAULT_REMINDER_TEMPLATE } from "@/lib/whatsapp/template-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60s on Vercel for QR generation & live scan detection

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const shopId = user.id; // active_workspace_id
    const { searchParams } = new URL(req.url);
    const shouldWait = searchParams.get("wait") === "true";

    // Long-poll waiting mode for Vercel: keeps lambda execution alive while waiting for mobile QR scan
    if (shouldWait) {
      const waitResult = await baileysEngine.waitForScanOrConnection(shopId, 24000);
      return NextResponse.json({
        status: waitResult.status,
        qrcode: waitResult.qrcode || null,
        connected_phone: waitResult.connectedPhone || null,
      });
    }

    // Standard session check
    const liveState = await baileysEngine.getOrStartShopSession(shopId);

    const sessionsCol = await getCollection(COLLECTIONS.WHATSAPP_SESSIONS);
    const sessionDoc = await sessionsCol.findOne({ shop_id: toObjectId(shopId) });

    const status = liveState.status || sessionDoc?.status || "disconnected";
    const qrcode = liveState.qrcode || sessionDoc?.qrcode || null;
    const connectedPhone = liveState.connectedPhone || sessionDoc?.connected_phone || null;

    return NextResponse.json({
      status,
      qrcode,
      connected_phone: connectedPhone,
      auto_reminder_enabled: Boolean(sessionDoc?.auto_reminder_enabled),
      min_overdue_days: sessionDoc?.min_overdue_days ?? 1,
      reminder_time: sessionDoc?.reminder_time_pkt || sessionDoc?.reminder_time || "10:00",
      reminder_time_pkt: sessionDoc?.reminder_time_pkt || sessionDoc?.reminder_time || "10:00",
      reminder_frequency: sessionDoc?.reminder_frequency || "daily",
      reminder_template: sessionDoc?.reminder_template || DEFAULT_REMINDER_TEMPLATE,
      gateway_configured: true,
    });
  } catch (error: any) {
    console.error("WhatsApp session GET error:", error);
    return NextResponse.json({ error: error?.message || "Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const shopId = user.id;
    const body = await req.json();
    const action = body?.action; // "connect" | "disconnect" | "refresh"

    if (action === "disconnect") {
      await baileysEngine.disconnectShopSession(shopId);
      return NextResponse.json({ success: true, status: "disconnected" });
    }

    if (action === "connect" || action === "refresh") {
      // Force refresh and await QR code generation so it's ready in this very HTTP response
      const sessionState = await baileysEngine.getOrStartShopSession(shopId, true, true);

      return NextResponse.json({
        success: true,
        status: sessionState.status,
        qrcode: sessionState.qrcode || null,
        connected_phone: sessionState.connectedPhone || null
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("WhatsApp session POST error:", error);
    return NextResponse.json({ error: error?.message || "Server Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const shopId = user.id;
    const body = await req.json();
    const {
      auto_reminder_enabled,
      min_overdue_days,
      reminder_time,
      reminder_time_pkt,
      reminder_frequency,
      reminder_template
    } = body;

    const timePkt = reminder_time_pkt || reminder_time || "10:00";
    const validFrequencies = ["daily", "weekly", "biweekly", "monthly"];
    const frequency = validFrequencies.includes(reminder_frequency) ? reminder_frequency : "daily";

    const sessionsCol = await getCollection(COLLECTIONS.WHATSAPP_SESSIONS);
    await sessionsCol.updateOne(
      { shop_id: toObjectId(shopId) },
      {
        $set: {
          auto_reminder_enabled: Boolean(auto_reminder_enabled),
          min_overdue_days: typeof min_overdue_days === "number" ? min_overdue_days : 1,
          reminder_time: timePkt,
          reminder_time_pkt: timePkt,
          reminder_frequency: frequency,
          reminder_template: typeof reminder_template === "string" ? reminder_template : DEFAULT_REMINDER_TEMPLATE,
          updated_at: new Date(),
        },
        $setOnInsert: {
          shop_id: toObjectId(shopId),
          instance_name: `shop_${shopId}`,
          status: "disconnected",
          created_at: new Date(),
        }
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("WhatsApp session PUT error:", error);
    return NextResponse.json({ error: error?.message || "Server Error" }, { status: 500 });
  }
}
