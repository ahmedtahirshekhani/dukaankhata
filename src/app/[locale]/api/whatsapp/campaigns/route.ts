import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS, toObjectId } from "@/lib/db/mongodb";
import { getCurrentUser } from "@/lib/auth/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const shopId = user.id;
    const campaignsCol = await getCollection(COLLECTIONS.WHATSAPP_CAMPAIGNS);

    const campaigns = await campaignsCol
      .find({ shop_id: toObjectId(shopId) })
      .sort({ created_at: -1 })
      .limit(50)
      .toArray();

    const formattedCampaigns = campaigns.map((camp) => ({
      id: camp._id.toString(),
      name: camp.name,
      status: camp.status || "draft",
      variants_count: (camp.variants || []).length,
      variants: camp.variants || [],
      cooldown_seconds: camp.cooldown_seconds || 20,
      cooldown_jitter: Boolean(camp.cooldown_jitter),
      batch_size: camp.batch_size || 10,
      batch_cooldown_seconds: camp.batch_cooldown_seconds || 180,
      total_recipients: camp.total_recipients || 0,
      sent_count: camp.sent_count || 0,
      failed_count: camp.failed_count || 0,
      created_at: camp.created_at,
      updated_at: camp.updated_at,
      last_run_at: camp.last_run_at,
    }));

    return NextResponse.json({ campaigns: formattedCampaigns });
  } catch (error: any) {
    console.error("Error fetching campaigns:", error);
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

    const {
      name,
      variants,
      cooldown_seconds = 20,
      cooldown_jitter = true,
      batch_size = 10,
      batch_cooldown_seconds = 180,
      recipient_ids = [],
    } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });
    }

    if (!Array.isArray(variants) || variants.length === 0) {
      return NextResponse.json({ error: "At least one message variant is required" }, { status: 400 });
    }

    // Filter valid variants
    const validVariants = variants
      .map((v: any, index: number) => ({
        id: v?.id || `var_${index + 1}`,
        text: (v?.text || "").trim(),
      }))
      .filter((v: any) => v.text.length > 0);

    if (validVariants.length === 0) {
      return NextResponse.json({ error: "Message variants cannot be empty" }, { status: 400 });
    }

    if (!Array.isArray(recipient_ids) || recipient_ids.length === 0) {
      return NextResponse.json({ error: "Please select at least one customer" }, { status: 400 });
    }

    // Load customer records from parties collection
    const partiesCol = await getCollection(COLLECTIONS.PARTIES);
    const objectIds = recipient_ids.map((id: string) => toObjectId(id));

    const selectedCustomers = await partiesCol
      .find({
        _id: { $in: objectIds },
        user_id: { $in: [toObjectId(shopId), shopId.toString()] },
      })
      .toArray();

    if (selectedCustomers.length === 0) {
      return NextResponse.json({ error: "No matching customers found" }, { status: 400 });
    }

    // Prepare recipients array with pending status
    const recipientsQueue = selectedCustomers.map((c) => {
      const rawPhone = (c.phone || c.mobile || c.whatsapp || c.contact_number || "").toString();
      const cleaned = rawPhone.replace(/\D/g, "");
      return {
        customer_id: c._id,
        customer_name: c.name || "Customer",
        customer_phone: cleaned,
        balance: c.balance || 0,
        status: "pending", // "pending" | "sent" | "failed"
        variant_used: null,
        message_id: null,
        error: null,
        sent_at: null,
      };
    });

    const campaignsCol = await getCollection(COLLECTIONS.WHATSAPP_CAMPAIGNS);

    const newCampaign = {
      shop_id: toObjectId(shopId),
      name: name.trim(),
      variants: validVariants,
      cooldown_seconds: Math.max(10, Math.min(120, Number(cooldown_seconds) || 20)),
      cooldown_jitter: Boolean(cooldown_jitter),
      batch_size: Math.max(5, Math.min(50, Number(batch_size) || 10)),
      batch_cooldown_seconds: Math.max(30, Math.min(600, Number(batch_cooldown_seconds) || 180)),
      total_recipients: recipientsQueue.length,
      sent_count: 0,
      failed_count: 0,
      status: "draft", // "draft" | "running" | "paused" | "completed" | "cancelled"
      recipients: recipientsQueue,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const insertResult = await campaignsCol.insertOne(newCampaign);

    return NextResponse.json({
      success: true,
      campaignId: insertResult.insertedId.toString(),
      campaign: {
        id: insertResult.insertedId.toString(),
        name: newCampaign.name,
        total_recipients: newCampaign.total_recipients,
        variants_count: newCampaign.variants.length,
        status: newCampaign.status,
      },
    });
  } catch (error: any) {
    console.error("Error creating campaign:", error);
    return NextResponse.json({ error: error?.message || "Server Error" }, { status: 500 });
  }
}
