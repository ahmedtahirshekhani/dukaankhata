// src/app/[locale]/api/reports/purchase-report/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS, toObjectId, isValidObjectId, updateUserLastActivity } from "@/lib/db/mongodb";
import { getCurrentUser } from "@/lib/auth/utils";
import { requirePermission } from "@/lib/auth/rbac";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request: NextRequest) {
  try {
    const user = (await getCurrentUser()) as { id: string } | null;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requirePermission("reports.view_purchase_report");
    if (!authCheck.allowed) return authCheck.response!;

    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const partyId = searchParams.get("partyId");
    const paymentStatus = searchParams.get("paymentStatus") || "all";
    const search = searchParams.get("search")?.trim() || "";
    const minAmount = searchParams.get("minAmount");
    const maxAmount = searchParams.get("maxAmount");
    const sortBy = searchParams.get("sortBy") || "bill_date";
    const sortOrder = searchParams.get("sortOrder") === "desc" ? -1 : 1;
    const page = parseInt(searchParams.get("page") || "1");
    const limitParam = searchParams.get("limit");
    const limit = limitParam === "-1" ? 0 : parseInt(limitParam || "10");
    const skip = limit > 0 ? (page - 1) * limit : 0;

    const userObjId = toObjectId(user.id);
    const purchaseBillsCollection = await getCollection(COLLECTIONS.PURCHASE_BILLS);

    // Build Match Query
    const matchQuery: any = {
      user_id: userObjId,
    };

    // Date Range Filter (matches on bill_date, purchase_date, date, or created_at)
    if (fromDate && toDate) {
      const from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);

      if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
        matchQuery.$and = matchQuery.$and || [];
        matchQuery.$and.push({
          $expr: {
            $let: {
              vars: {
                rawDate: {
                  $ifNull: [
                    "$bill_date",
                    {
                      $ifNull: [
                        "$purchase_date",
                        { $ifNull: ["$date", "$created_at"] },
                      ],
                    },
                  ],
                },
              },
              in: {
                $let: {
                  vars: {
                    parsedDate: {
                      $convert: {
                        input: "$$rawDate",
                        to: "date",
                        onError: null,
                        onNull: null,
                      },
                    },
                  },
                  in: {
                    $and: [
                      { $ne: ["$$parsedDate", null] },
                      { $gte: ["$$parsedDate", from] },
                      { $lte: ["$$parsedDate", to] },
                    ],
                  },
                },
              },
            },
          },
        });
      }
    }

    // Party Filter
    if (partyId && partyId !== "all") {
      if (isValidObjectId(partyId)) {
        matchQuery.party_id = toObjectId(partyId);
      } else {
        matchQuery.party_id = partyId;
      }
    }

    // Payment Status Filter
    if (paymentStatus === "paid") {
      matchQuery.$and = matchQuery.$and || [];
      matchQuery.$and.push({
        $or: [
          { is_paid: true },
          { balance_due: { $lte: 0 } },
        ],
      });
    } else if (paymentStatus === "unpaid") {
      matchQuery.$and = matchQuery.$and || [];
      matchQuery.$and.push({
        $or: [
          { paid_amount: { $lte: 0 } },
          { paid_amount: { $exists: false } },
        ],
        is_paid: { $ne: true },
      });
    } else if (paymentStatus === "partial") {
      matchQuery.$and = matchQuery.$and || [];
      matchQuery.$and.push({
        paid_amount: { $gt: 0 },
        balance_due: { $gt: 0 },
        is_paid: { $ne: true },
      });
    }

    // Amount Range Filter
    if (minAmount && !isNaN(Number(minAmount))) {
      matchQuery.total_amount = matchQuery.total_amount || {};
      matchQuery.total_amount.$gte = Number(minAmount);
    }
    if (maxAmount && !isNaN(Number(maxAmount))) {
      matchQuery.total_amount = matchQuery.total_amount || {};
      matchQuery.total_amount.$lte = Number(maxAmount);
    }

    // Search Filter
    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), "i");
      matchQuery.$and = matchQuery.$and || [];
      matchQuery.$and.push({
        $or: [
          { party_name: searchRegex },
          { purchase_number: searchRegex },
          { purchase_no: searchRegex },
          { bill_number: searchRegex },
          { description: searchRegex },
          { "items.product_name": searchRegex },
          { "items.name": searchRegex },
        ],
      });
    }

    // Determine Sort
    const sortFieldMap: Record<string, string> = {
      bill_date: "effective_date",
      date: "effective_date",
      purchase_date: "effective_date",
      created_at: "effective_date",
      total_amount: "total_amount",
      paid_amount: "paid_amount",
      balance_due: "balance_due",
      party_name: "party_name",
      purchase_number: "purchase_number",
    };
    const sortField = sortFieldMap[sortBy] || "effective_date";

    const addFieldsStage = {
      $addFields: {
        effective_date: {
          $convert: {
            input: {
              $ifNull: [
                "$bill_date",
                {
                  $ifNull: [
                    "$purchase_date",
                    { $ifNull: ["$date", "$created_at"] },
                  ],
                },
              ],
            },
            to: "date",
            onError: "$created_at",
            onNull: "$created_at",
          },
        },
      },
    };

    // Summary Pipeline
    const summaryPipeline: any[] = [
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalPurchases: { $sum: { $ifNull: ["$total_amount", 0] } },
          totalPaid: { $sum: { $ifNull: ["$paid_amount", 0] } },
          totalBalanceDue: { $sum: { $ifNull: ["$balance_due", 0] } },
          totalBillsCount: { $sum: 1 },
          totalItemsPurchased: {
            $sum: {
              $reduce: {
                input: { $ifNull: ["$items", []] },
                initialValue: 0,
                in: { $add: ["$$value", { $ifNull: ["$$this.quantity", 0] }] },
              },
            },
          },
          fullyPaidCount: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ["$is_paid", true] },
                    { $lte: [{ $ifNull: ["$balance_due", 0] }, 0] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          unpaidCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $lte: [{ $ifNull: ["$paid_amount", 0] }, 0] },
                    { $ne: ["$is_paid", true] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          partialCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: [{ $ifNull: ["$paid_amount", 0] }, 0] },
                    { $gt: [{ $ifNull: ["$balance_due", 0] }, 0] },
                    { $ne: ["$is_paid", true] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ];

    // Data Pipeline (sorts ascending by effective_date by default: fromDate to toDate)
    const dataPipeline: any[] = [
      { $match: matchQuery },
      addFieldsStage,
      { $sort: { [sortField]: sortOrder, _id: 1 } },
    ];

    if (skip > 0) {
      dataPipeline.push({ $skip: skip });
    }
    if (limit > 0) {
      dataPipeline.push({ $limit: limit });
    }

    // Run in parallel
    const [summaryResult, billsDocs] = await Promise.all([
      purchaseBillsCollection.aggregate(summaryPipeline).toArray(),
      purchaseBillsCollection.aggregate(dataPipeline).toArray(),
    ]);

    const rawSummary = summaryResult[0] || {};
    const totalPurchases = rawSummary.totalPurchases || 0;
    const totalBillsCount = rawSummary.totalBillsCount || 0;
    const averageBillValue = totalBillsCount > 0 ? totalPurchases / totalBillsCount : 0;

    const summary = {
      totalPurchases,
      totalPaid: rawSummary.totalPaid || 0,
      totalBalanceDue: rawSummary.totalBalanceDue || 0,
      totalBillsCount,
      totalItemsPurchased: rawSummary.totalItemsPurchased || 0,
      averageBillValue,
      fullyPaidCount: rawSummary.fullyPaidCount || 0,
      unpaidCount: rawSummary.unpaidCount || 0,
      partialCount: rawSummary.partialCount || 0,
    };

    // Format bills
    const formattedBills = billsDocs.map((bill: any) => {
      const paid = Number(bill.paid_amount) || 0;
      const total = Number(bill.total_amount) || 0;
      const balance = Number(bill.balance_due) ?? (total - paid);
      const isPaid = Boolean(bill.is_paid || balance <= 0);

      let status: "paid" | "partial" | "unpaid" = "unpaid";
      if (isPaid || balance <= 0) {
        status = "paid";
      } else if (paid > 0 && balance > 0) {
        status = "partial";
      }

      const items = Array.isArray(bill.items)
        ? bill.items.map((i: any) => ({
            product_id: i.product_id?.toString() || i.id?.toString() || "",
            product_name: i.product_name || i.name || "Item",
            quantity: Number(i.quantity) || 1,
            cost_price: Number(i.cost_price || i.price || i.unit_price) || 0,
            amount: Number(i.amount || i.total) || 0,
          }))
        : [];

      const billDate =
        bill.bill_date ||
        bill.purchase_date ||
        bill.date ||
        bill.created_at ||
        new Date().toISOString();

      return {
        id: bill._id.toString(),
        purchase_number: bill.purchase_number || bill.purchase_no || bill.bill_number || `PB-${bill._id.toString().slice(-6)}`,
        bill_number: bill.bill_number || bill.purchase_number || bill.purchase_no || "",
        party_id: bill.party_id ? bill.party_id.toString() : "",
        party_name: bill.party_name || "Unknown Party",
        total_amount: total,
        paid_amount: paid,
        balance_due: balance,
        is_paid: isPaid,
        status,
        payment_method_name: bill.payment_method_name || (bill.payment_method_id ? "Direct" : "-"),
        description: bill.description || "",
        items_count: items.length,
        items,
        bill_date: billDate,
        created_at: billDate,
      };
    });

    await updateUserLastActivity();

    return NextResponse.json({
      summary,
      bills: formattedBills,
      pagination: {
        total: totalBillsCount,
        page,
        limit: limit > 0 ? limit : totalBillsCount,
        totalPages: limit > 0 ? Math.ceil(totalBillsCount / limit) : 1,
      },
    });
  } catch (error: any) {
    console.error("Error in purchase-report API:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate purchase report" },
      { status: 500 }
    );
  }
}
