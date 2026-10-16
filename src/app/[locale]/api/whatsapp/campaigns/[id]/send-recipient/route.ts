import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS, toObjectId } from "@/lib/db/mongodb";
import { getCurrentUser } from "@/lib/auth/utils";
import { baileysEngine } from "@/lib/whatsapp/baileys-engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow sufficient time for Baileys typing simulation and socket dispatch

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const shopId = user.id;
    const campaignId = params.id;
    const body = await req.json().catch(() => ({}));

    const campaignsCol = await getCollection(COLLECTIONS.WHATSAPP_CAMPAIGNS);
    const partiesCol = await getCollection(COLLECTIONS.PARTIES);
    const shopsCol = await getCollection(COLLECTIONS.SHOPS);
    const logsCol = await getCollection(COLLECTIONS.WHATSAPP_CAMPAIGN_LOGS);

    const campaign = await campaignsCol.findOne({
      _id: toObjectId(campaignId),
      shop_id: toObjectId(shopId),
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Determine target recipient (by explicit index or first pending)
    let targetIndex = -1;
    if (typeof body.recipient_index === "number" && campaign.recipients[body.recipient_index]) {
      targetIndex = body.recipient_index;
    } else {
      targetIndex = campaign.recipients.findIndex((r: any) => r.status === "pending");
    }

    if (targetIndex === -1) {
      // All recipients are processed
      await campaignsCol.updateOne(
        { _id: toObjectId(campaignId) },
        { $set: { status: "completed", updated_at: new Date() } }
      );
      return NextResponse.json({
        completed: true,
        message: "All recipients have been processed",
        sentCount: campaign.sent_count,
        totalCount: campaign.total_recipients,
      });
    }

    const recipient = campaign.recipients[targetIndex];
    const customerPhone = (recipient.customer_phone || "").replace(/\D/g, "");

    if (!customerPhone || customerPhone.length < 10) {
      // Invalid phone, mark failed and continue
      const errorMsg = "Invalid phone number";
      await campaignsCol.updateOne(
        { _id: toObjectId(campaignId) },
        {
          $set: {
            [`recipients.${targetIndex}.status`]: "failed",
            [`recipients.${targetIndex}.error`]: errorMsg,
            [`recipients.${targetIndex}.sent_at`]: new Date(),
            updated_at: new Date(),
          },
          $inc: { failed_count: 1 },
        }
      );

      return NextResponse.json({
        success: false,
        error: errorMsg,
        recipientIndex: targetIndex,
        customerName: recipient.customer_name,
      });
    }

    // 1. Pick a random variant from multiple available variants
    const variants = campaign.variants || [];
    if (variants.length === 0) {
      return NextResponse.json({ error: "No message variants defined" }, { status: 400 });
    }
    const chosenVariant = variants[Math.floor(Math.random() * variants.length)];

    // 2. Fetch shop metadata for template variable replacement
    const shopDoc = await shopsCol.findOne({ _id: toObjectId(shopId) });
    const shopName = shopDoc?.name || "Hamari Dukaan";

    // 3. Interpolate variables into message text
    const todayFormatted = new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date());

    let compiledText = chosenVariant.text
      .replace(/\{customer_name\}/gi, recipient.customer_name || "Valued Customer")
      .replace(/\{shop_name\}/gi, shopName)
      .replace(/\{balance\}/gi, recipient.balance ? `Rs. ${recipient.balance}` : "Rs. 0")
      .replace(/\{phone\}/gi, recipient.customer_phone || "")
      .replace(/\{date\}/gi, todayFormatted);

    // 4. Dispatch message via Baileys Engine with Anti-Ban Human Typing Simulation
    const sendResult = await baileysEngine.sendTextMessage(shopId, customerPhone, compiledText, {
      simulateTyping: true,
      minTypingMs: 1500,
      maxTypingMs: 3000,
    });

    const now = new Date();

    if (sendResult.success) {
      // 5. Update party with last_marketing_sent_at so "never sent on top" works across the system
      if (recipient.customer_id) {
        await partiesCol.updateOne(
          { _id: toObjectId(recipient.customer_id) },
          {
            $set: { last_marketing_sent_at: now },
            $inc: { marketing_messages_sent_count: 1 },
          }
        );
      }

      // 6. Record marketing log in whatsapp_campaign_logs
      await logsCol.insertOne({
        campaign_id: toObjectId(campaignId),
        shop_id: toObjectId(shopId),
        customer_id: recipient.customer_id ? toObjectId(recipient.customer_id) : null,
        customer_name: recipient.customer_name,
        customer_phone: customerPhone,
        message_text: compiledText,
        variant_id: chosenVariant.id,
        status: "sent",
        message_id: sendResult.messageId || null,
        sent_at: now,
      });

      // 7. Update recipient status in campaign document
      const newSentCount = (campaign.sent_count || 0) + 1;
      const isFinished = newSentCount + (campaign.failed_count || 0) >= campaign.total_recipients;

      await campaignsCol.updateOne(
        { _id: toObjectId(campaignId) },
        {
          $set: {
            [`recipients.${targetIndex}.status`]: "sent",
            [`recipients.${targetIndex}.variant_used`]: chosenVariant.id,
            [`recipients.${targetIndex}.message_id`]: sendResult.messageId || null,
            [`recipients.${targetIndex}.sent_at`]: now,
            status: isFinished ? "completed" : "running",
            last_run_at: now,
            updated_at: now,
          },
          $inc: { sent_count: 1 },
        }
      );

      return NextResponse.json({
        success: true,
        messageId: sendResult.messageId,
        recipientIndex: targetIndex,
        customerName: recipient.customer_name,
        customerPhone,
        variantId: chosenVariant.id,
        sentCount: newSentCount,
        failedCount: campaign.failed_count || 0,
        totalCount: campaign.total_recipients,
        isCompleted: isFinished,
      });
    } else {
      // Record failure
      await logsCol.insertOne({
        campaign_id: toObjectId(campaignId),
        shop_id: toObjectId(shopId),
        customer_id: recipient.customer_id ? toObjectId(recipient.customer_id) : null,
        customer_name: recipient.customer_name,
        customer_phone: customerPhone,
        message_text: compiledText,
        variant_id: chosenVariant.id,
        status: "failed",
        error: sendResult.error || "Failed to send message",
        sent_at: now,
      });

      const newFailedCount = (campaign.failed_count || 0) + 1;
      const isFinished = (campaign.sent_count || 0) + newFailedCount >= campaign.total_recipients;

      await campaignsCol.updateOne(
        { _id: toObjectId(campaignId) },
        {
          $set: {
            [`recipients.${targetIndex}.status`]: "failed",
            [`recipients.${targetIndex}.variant_used`]: chosenVariant.id,
            [`recipients.${targetIndex}.error`]: sendResult.error || "Failed",
            [`recipients.${targetIndex}.sent_at`]: now,
            status: isFinished ? "completed" : "running",
            last_run_at: now,
            updated_at: now,
          },
          $inc: { failed_count: 1 },
        }
      );

      return NextResponse.json({
        success: false,
        error: sendResult.error,
        recipientIndex: targetIndex,
        customerName: recipient.customer_name,
        customerPhone,
        sentCount: campaign.sent_count || 0,
        failedCount: newFailedCount,
        totalCount: campaign.total_recipients,
        isCompleted: isFinished,
      });
    }
  } catch (error: any) {
    console.error("Error in campaign send-recipient route:", error);
    return NextResponse.json({ error: error?.message || "Server Error" }, { status: 500 });
  }
}
