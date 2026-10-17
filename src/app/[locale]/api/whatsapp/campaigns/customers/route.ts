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
    const shopObjId = toObjectId(shopId);
    const { searchParams } = new URL(req.url);

    const filterType = searchParams.get("filter") || "all"; // "all" | "never_sent" | "with_balance" | "zero_balance"
    const searchQuery = searchParams.get("search")?.trim() || "";

    const partiesCol = await getCollection(COLLECTIONS.PARTIES);

    // Build match conditions
    const matchQuery: Record<string, any> = {
      user_id: { $in: [shopObjId, shopId.toString()] },
      is_delete: { $ne: 1 },
    };

    if (searchQuery) {
      matchQuery.$or = [
        { name: { $regex: searchQuery, $options: "i" } },
        { phone: { $regex: searchQuery, $options: "i" } },
        { mobile: { $regex: searchQuery, $options: "i" } },
        { whatsapp: { $regex: searchQuery, $options: "i" } },
        { company_name: { $regex: searchQuery, $options: "i" } },
      ];
    }

    if (filterType === "never_sent") {
      matchQuery.$or = [
        { last_marketing_sent_at: { $exists: false } },
        { last_marketing_sent_at: null },
      ];
    } else if (filterType === "with_balance") {
      matchQuery.balance = { $gt: 0 };
    } else if (filterType === "zero_balance") {
      matchQuery.balance = { $lte: 0 };
    }

    // Aggregation pipeline to ensure "Never Sent on Top", followed by oldest sent date
    const pipeline: any[] = [
      { $match: matchQuery },
      {
        $addFields: {
          // Normalize primary phone number
          primary_phone: {
            $ifNull: ["$phone", { $ifNull: ["$mobile", { $ifNull: ["$whatsapp", "$contact_number"] }] }]
          },
          // 0 for never sent (comes first), 1 for already sent
          never_sent_rank: {
            $cond: [
              {
                $or: [
                  { $eq: ["$last_marketing_sent_at", null] },
                  { $not: ["$last_marketing_sent_at"] }
                ]
              },
              0,
              1
            ]
          }
        }
      },
      {
        $sort: {
          never_sent_rank: 1, // 0 (Never Sent) strictly on top!
          last_marketing_sent_at: 1, // Oldest sent next, most recently sent at bottom
          name: 1,
        }
      }
    ];

    const customers = await partiesCol.aggregate(pipeline).toArray();

    // Map and sanitize customer list
    let neverSentCount = 0;
    let alreadySentCount = 0;

    const formattedCustomers = customers.map((c) => {
      const rawPhone = (c.primary_phone || "").toString();
      const cleaned = rawPhone.replace(/\D/g, "");
      const hasValidPhone = cleaned.length >= 10;
      const isNeverSent = !c.last_marketing_sent_at;

      if (isNeverSent) {
        neverSentCount++;
      } else {
        alreadySentCount++;
      }

      return {
        id: c._id.toString(),
        name: c.name || "Customer",
        company_name: c.company_name || "",
        phone: rawPhone,
        cleaned_phone: cleaned,
        has_valid_phone: hasValidPhone,
        balance: c.balance || 0,
        last_marketing_sent_at: c.last_marketing_sent_at || null,
        marketing_messages_sent_count: c.marketing_messages_sent_count || 0,
      };
    });

    return NextResponse.json({
      customers: formattedCustomers,
      totalCount: formattedCustomers.length,
      neverSentCount,
      alreadySentCount,
    });
  } catch (error: any) {
    console.error("Error fetching campaign customers:", error);
    return NextResponse.json({ error: error?.message || "Server Error" }, { status: 500 });
  }
}
