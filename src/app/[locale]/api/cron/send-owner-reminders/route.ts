import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS, toObjectId } from "@/lib/db/mongodb";
import { baileysEngine } from "@/lib/whatsapp/baileys-engine";
import { getCurrentUser } from "@/lib/auth/utils";
import { compileReminderMessage, DEFAULT_REMINDER_TEMPLATE } from "@/lib/whatsapp/template-utils";

export async function POST(req: NextRequest) {
  let forceSend = true; // Default manual POST triggers to force send for easy testing
  try {
    const body = await req.json();
    if (typeof body?.force === "boolean") {
      forceSend = body.force;
    }
  } catch (e) {}

  return handleRemindersDispatch(req, forceSend);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const forceSend = searchParams.get("force") === "true";
  return handleRemindersDispatch(req, forceSend);
}

async function handleRemindersDispatch(req: NextRequest, forceSend: boolean) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET || process.env.CRON_SECRET_TOKEN;
    const searchToken = req.nextUrl.searchParams.get("token") || req.nextUrl.searchParams.get("secret");
    const xCronSecret = req.headers.get("x-cron-secret");

    let isCronAuthorized = false;

    // In development mode or if no CRON_SECRET is defined, allow execution for testing
    if (process.env.NODE_ENV !== "production" || !cronSecret) {
      isCronAuthorized = true;
    } else if (cronSecret) {
      // In production, enforce secret token validation
      if (
        (authHeader && (authHeader === `Bearer ${cronSecret}` || authHeader === cronSecret)) ||
        (searchToken && searchToken === cronSecret) ||
        (xCronSecret && xCronSecret === cronSecret)
      ) {
        isCronAuthorized = true;
      }
    }

    let targetShopId: string | null = null;
    try {
      const user = await getCurrentUser();
      if (user?.id) {
        targetShopId = user.id;
      }
    } catch (err) {
      // Ignore auth error if attempting cron
    }

    if (!isCronAuthorized && !targetShopId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionsCol = await getCollection(COLLECTIONS.WHATSAPP_SESSIONS);
    const partiesCol = await getCollection(COLLECTIONS.PARTIES);
    const shopsCol = await getCollection(COLLECTIONS.SHOPS);
    const logsCol = await getCollection(COLLECTIONS.WHATSAPP_REMINDER_LOGS);

    let sessions: any[] = [];
    if (targetShopId) {
      const shopObjId = toObjectId(targetShopId);
      sessions = await sessionsCol.find({
        shop_id: { $in: [shopObjId, targetShopId.toString()] }
      }).toArray();

      // If no explicit settings doc exists yet for this shop, create a fallback session object so manual triggers work
      if (sessions.length === 0) {
        sessions = [{
          shop_id: shopObjId,
          auto_reminder_enabled: true,
          reminder_template: DEFAULT_REMINDER_TEMPLATE
        }];
      }
    } else {
      sessions = await sessionsCol.find({
        auto_reminder_enabled: { $in: [true, "true", 1] }
      }).toArray();
    }

    if (sessions.length === 0) {
      return NextResponse.json({
        message: "No WhatsApp sessions configured for sending reminders.",
        processedCount: 0,
        totalRemindersSent: 0
      });
    }

    const now = new Date();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Get current Pakistan Standard Time (PKT / UTC+5) hour (0-23)
    const currentPktHourStr = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Karachi",
      hour: "numeric",
      hourCycle: "h23"
    }).format(now);
    const currentPktHour = parseInt(currentPktHourStr, 10);

    let totalRemindersSent = 0;
    let totalErrors = 0;
    const sessionDetails: Array<{ shopId: string; sent: number; errors: number; skippedTime?: boolean; skippedDisabled?: boolean }> = [];

    for (const session of sessions) {
      const shopId = session.shop_id.toString();

      // 1. Strictly enforce auto_reminder_enabled check for automated cron runs (forceSend === false)
      const isAutoEnabled = Boolean(session.auto_reminder_enabled);
      if (!forceSend && !isAutoEnabled) {
        sessionDetails.push({ shopId, sent: 0, errors: 0, skippedDisabled: true });
        continue;
      }

      // 2. Enforce scheduled PKT time arrival for automated cron runs (forceSend === false)
      if (!forceSend) {
        const scheduledTimePkt = session.reminder_time_pkt || session.reminder_time || "13:00";
        const scheduledHour = parseInt(scheduledTimePkt.split(":")[0], 10);
        if (!isNaN(scheduledHour) && currentPktHour < scheduledHour) {
          sessionDetails.push({ shopId, sent: 0, errors: 0, skippedTime: true });
          continue; // Skip session if current hour hasn't reached scheduled PKT hour yet today
        }
      }

      const frequency = session.reminder_frequency || "daily";

      // 3. Determine frequency cutoff date based on selected frequency
      let frequencyCutoff: Date;
      if (frequency === "weekly") {
        frequencyCutoff = new Date(now.getTime() - 7 * 86400000);
      } else if (frequency === "biweekly") {
        frequencyCutoff = new Date(now.getTime() - 14 * 86400000);
      } else if (frequency === "monthly") {
        frequencyCutoff = new Date(now.getTime() - 30 * 86400000);
      } else {
        frequencyCutoff = startOfToday; // daily
      }

      // Check shop metadata
      const shop = await shopsCol.findOne({ _id: session.shop_id });
      const shopName = shop?.name || session.company_name || "Hamari Dukaan";

      const shopObjId = toObjectId(shopId);
      const shopStr = shopId;

      // Query customers / parties with positive balance (money owed to shop)
      const overdueCustomers = await partiesCol.find({
        user_id: { $in: [shopObjId, shopStr] },
        balance: { $gt: 0 },
        is_delete: { $ne: 1 }
      }).toArray();

      let shopSent = 0;
      let shopErrors = 0;
      let customerIndex = 0;
      for (const customer of overdueCustomers) {
        try {
          const rawPhone = (customer.phone || customer.mobile || customer.whatsapp || customer.contact_number || "").toString();
          const cleanedPhone = rawPhone.replace(/\D/g, "");
          if (!cleanedPhone || cleanedPhone.length < 10) continue;

          // Add a 1.5s throttling delay between consecutive dispatches to prevent Baileys socket collisions or WhatsApp rate limiting
          if (customerIndex > 0) {
            await new Promise((r) => setTimeout(r, 1500));
          }
          customerIndex++;

          // 4. Strictly enforce frequency cutoff for automated cron dispatches (unless forceSend === true)
          if (!forceSend) {
            const existingLog = await logsCol.findOne({
              shop_id: { $in: [toObjectId(session.shop_id), session.shop_id.toString()] },
              customer_id: customer._id,
              status: "sent",
              sent_at: { $gte: frequencyCutoff }
            });

            if (existingLog) continue;
          }

          const customerName = customer.name || "Valued Customer";
          const dueBalance = Math.floor(customer.balance || 0);

          const paymentToken = customer.payment_token || customer._id.toString();
          const paymentUrl = `https://dukaankhata.pk/pay/${paymentToken}`;

          // Compile text message using shopkeeper's custom template
          const messageText = compileReminderMessage(session.reminder_template, {
            customerName,
            shopName,
            dueBalance,
            paymentUrl
          });

          // Send directly from shop owner's connected WhatsApp session via Baileys Engine
          const sendResult = await baileysEngine.sendTextMessage(shopId, cleanedPhone, messageText);

          if (sendResult.success) {
            totalRemindersSent++;
            shopSent++;
            await logsCol.insertOne({
              shop_id: session.shop_id,
              customer_id: customer._id,
              customer_name: customerName,
              customer_phone: cleanedPhone,
              amount_due: dueBalance,
              status: "sent",
              message_id: sendResult.messageId || null,
              sent_at: new Date()
            });
          } else {
            totalErrors++;
            shopErrors++;
            await logsCol.insertOne({
              shop_id: session.shop_id,
              customer_id: customer._id,
              customer_name: customerName,
              customer_phone: cleanedPhone,
              amount_due: dueBalance,
              status: "failed",
              error: sendResult.error || "Failed to send message",
              sent_at: new Date()
            });
          }
        } catch (custErr: any) {
          totalErrors++;
          shopErrors++;
          console.error(`Error sending reminder to customer ${customer.name || customer._id}:`, custErr);
        }
      }

      sessionDetails.push({ shopId, sent: shopSent, errors: shopErrors });
    }

    return NextResponse.json({
      success: true,
      processedSessions: sessions.length,
      currentPktHour,
      totalRemindersSent,
      totalErrors,
      sessionDetails
    });
  } catch (error: any) {
    console.error("Cron send-owner-reminders error:", error);
    return NextResponse.json({ error: error?.message || "Internal Error" }, { status: 500 });
  }
}
