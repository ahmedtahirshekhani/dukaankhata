import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS, toObjectId } from "@/lib/db/mongodb";
import { getCurrentUser } from "@/lib/auth/utils";
import { requirePermission } from "@/lib/auth/rbac";

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser() as { id: string } | null;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requirePermission("configuration.edit");
    if (!authCheck.allowed) return authCheck.response!;

    const body = await request.json();
    const configCollection = await getCollection(COLLECTIONS.CONFIGURATIONS);

    const updateDoc = {
      $set: {
        is_counterSale_enable: body.is_counterSale_enable,
        is_AI_Chat_Enable: body.is_AI_Chat_Enable,
        is_Whatsapp_enable: body.is_Whatsapp_enable,
        updated_at: new Date(),
      },
    };

    const result = await configCollection.updateOne(
      { user_id: toObjectId(user.id) },
      updateDoc,
      { upsert: true }
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Configuration update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
