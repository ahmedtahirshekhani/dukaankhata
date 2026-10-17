import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS, toObjectId } from "@/lib/db/mongodb";
import { getCurrentUser } from "@/lib/auth/utils";

export const dynamic = "force-dynamic";

export async function PUT(
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
    const body = await req.json();
    const status = body?.status;

    const validStatuses = ["draft", "running", "paused", "completed", "cancelled"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const campaignsCol = await getCollection(COLLECTIONS.WHATSAPP_CAMPAIGNS);

    const updateResult = await campaignsCol.updateOne(
      {
        _id: toObjectId(campaignId),
        shop_id: toObjectId(shopId),
      },
      {
        $set: {
          status,
          updated_at: new Date(),
        },
      }
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, status });
  } catch (error: any) {
    console.error("Error updating campaign status:", error);
    return NextResponse.json({ error: error?.message || "Server Error" }, { status: 500 });
  }
}
