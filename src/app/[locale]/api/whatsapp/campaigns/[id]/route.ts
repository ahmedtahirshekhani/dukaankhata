import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS, toObjectId } from "@/lib/db/mongodb";
import { getCurrentUser } from "@/lib/auth/utils";

export const dynamic = "force-dynamic";

export async function GET(
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

    const campaignsCol = await getCollection(COLLECTIONS.WHATSAPP_CAMPAIGNS);
    const logsCol = await getCollection(COLLECTIONS.WHATSAPP_CAMPAIGN_LOGS);

    const campaign = await campaignsCol.findOne({
      _id: toObjectId(campaignId),
      shop_id: toObjectId(shopId),
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Fetch recent logs
    const recentLogs = await logsCol
      .find({ campaign_id: toObjectId(campaignId) })
      .sort({ sent_at: -1 })
      .limit(100)
      .toArray();

    return NextResponse.json({
      campaign: {
        id: campaign._id.toString(),
        name: campaign.name,
        status: campaign.status || "draft",
        variants: campaign.variants || [],
        cooldown_seconds: campaign.cooldown_seconds || 20,
        cooldown_jitter: Boolean(campaign.cooldown_jitter),
        batch_size: campaign.batch_size || 10,
        batch_cooldown_seconds: campaign.batch_cooldown_seconds || 180,
        total_recipients: campaign.total_recipients || 0,
        sent_count: campaign.sent_count || 0,
        failed_count: campaign.failed_count || 0,
        recipients: (campaign.recipients || []).map((r: any, idx: number) => ({
          index: idx,
          customer_id: r.customer_id?.toString() || "",
          customer_name: r.customer_name || "Customer",
          customer_phone: r.customer_phone || "",
          balance: r.balance || 0,
          status: r.status || "pending",
          variant_used: r.variant_used || null,
          error: r.error || null,
          sent_at: r.sent_at || null,
        })),
        created_at: campaign.created_at,
        updated_at: campaign.updated_at,
      },
      logs: recentLogs.map((l) => ({
        id: l._id.toString(),
        customer_name: l.customer_name,
        customer_phone: l.customer_phone,
        status: l.status,
        variant_id: l.variant_id,
        message_id: l.message_id,
        error: l.error,
        sent_at: l.sent_at,
      })),
    });
  } catch (error: any) {
    console.error("Error fetching campaign details:", error);
    return NextResponse.json({ error: error?.message || "Server Error" }, { status: 500 });
  }
}

export async function DELETE(
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

    const campaignsCol = await getCollection(COLLECTIONS.WHATSAPP_CAMPAIGNS);
    const logsCol = await getCollection(COLLECTIONS.WHATSAPP_CAMPAIGN_LOGS);

    const deleteResult = await campaignsCol.deleteOne({
      _id: toObjectId(campaignId),
      shop_id: toObjectId(shopId),
    });

    if (deleteResult.deletedCount === 0) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Clean up logs
    await logsCol.deleteMany({ campaign_id: toObjectId(campaignId) });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting campaign:", error);
    return NextResponse.json({ error: error?.message || "Server Error" }, { status: 500 });
  }
}
