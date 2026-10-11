import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS, toObjectId } from "@/lib/db/mongodb";
import { getCurrentUser } from "@/lib/auth/utils";
import { requirePermission } from "@/lib/auth/rbac";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser() as { id: string } | null;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const configCollection = await getCollection(COLLECTIONS.CONFIGURATIONS);
    const config = await configCollection.findOne({ user_id: toObjectId(user.id) });

    return NextResponse.json({
      is_counterSale_enable: config?.is_counterSale_enable ?? false,
      is_AI_Chat_Enable: config?.is_AI_Chat_Enable ?? true,
      is_Whatsapp_enable: config?.is_Whatsapp_enable ?? false,
      stock_valuation_method: config?.stock_valuation_method || "average",
    }, { status: 200 });
  } catch (error) {
    console.error("Configuration fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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

    const updateFields: any = {
      updated_at: new Date(),
    };

    if (body.is_counterSale_enable !== undefined) {
      updateFields.is_counterSale_enable = Boolean(body.is_counterSale_enable);
    }
    if (body.is_AI_Chat_Enable !== undefined) {
      updateFields.is_AI_Chat_Enable = Boolean(body.is_AI_Chat_Enable);
    }
    if (body.is_Whatsapp_enable !== undefined) {
      updateFields.is_Whatsapp_enable = Boolean(body.is_Whatsapp_enable);
    }
    if (body.stock_valuation_method !== undefined) {
      const method = String(body.stock_valuation_method).toLowerCase();
      if (method === "average" || method === "fifo" || method === "static") {
        updateFields.stock_valuation_method = method;
      }
    }

    await configCollection.updateOne(
      { user_id: toObjectId(user.id) },
      { $set: updateFields },
      { upsert: true }
    );

    return NextResponse.json({ success: true, updated: updateFields }, { status: 200 });
  } catch (error) {
    console.error("Configuration update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

