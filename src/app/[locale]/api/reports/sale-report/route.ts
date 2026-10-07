// src/app/[locale]/api/reports/sale-report/route.ts

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

    const authCheck = await requirePermission("reports.view_sale_report");
    if (!authCheck.allowed) return authCheck.response!;

    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const partyId = searchParams.get("partyId") || searchParams.get("customerId");
    const paymentStatus = searchParams.get("paymentStatus") || "all";
    const search = searchParams.get("search")?.trim() || "";
    const minAmount = searchParams.get("minAmount");
    const maxAmount = searchParams.get("maxAmount");
    const sortBy = searchParams.get("sortBy") || "invoice_date";
    const sortOrder = searchParams.get("sortOrder") === "desc" ? -1 : 1;
    const page = parseInt(searchParams.get("page") || "1");
    const limitParam = searchParams.get("limit");
    const limit = limitParam === "-1" ? 0 : parseInt(limitParam || "10");
    const skip = limit > 0 ? (page - 1) * limit : 0;

    const userObjId = toObjectId(user.id);
    const ordersCollection = await getCollection(COLLECTIONS.ORDERS);
    const paymentMethodsCollection = await getCollection(COLLECTIONS.PAYMENT_METHODS);

    // Fetch user payment methods map for easy name resolution
    const paymentMethods = await paymentMethodsCollection
      .find({ user_id: userObjId })
      .project({ _id: 1, bank_name: 1, account_title: 1 })
      .toArray();

    const paymentMethodMap = new Map<string, string>();
    paymentMethods.forEach((pm) => {
      paymentMethodMap.set(pm._id.toString(), pm.bank_name || pm.account_title || "Bank");
    });

    // 1. Base Match Query
    const matchQuery: any = {
      user_id: userObjId,
      is_delete: { $nin: [1, true, "1"] },
      is_deleted: { $nin: [1, true, "1"] },
      isDelete: { $nin: [1, true, "1"] },
      isDeleted: { $ne: true },
      status: { $nin: ["cancelled", "deleted", "inactive", "Cancelled", "Deleted", "Inactive"] },
    };

    // Date Range Filter (effective date based on sale_date, order_date, date, or created_at)
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
                    "$sale_date",
                    {
                      $ifNull: [
                        "$order_date",
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

    // Party / Customer Filter
    if (partyId && partyId !== "all") {
      const matchPartyIds: any[] = [partyId];
      if (isValidObjectId(partyId)) {
        matchPartyIds.push(toObjectId(partyId));
      }
      matchQuery.$and = matchQuery.$and || [];
      matchQuery.$and.push({
        $or: [
          { customer_id: { $in: matchPartyIds } },
          { party_id: { $in: matchPartyIds } },
        ],
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

    // Add Fields Stage for Computed Financials and Dates
    const addFieldsStage = {
      $addFields: {
        effective_date: {
          $convert: {
            input: {
              $ifNull: [
                "$sale_date",
                {
                  $ifNull: [
                    "$order_date",
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
        computed_total_amount: { $ifNull: ["$total_amount", 0] },
        computed_paid_amount: {
          $ifNull: [
            "$payment.paid_amount",
            {
              $ifNull: [
                "$paid_amount",
                { $ifNull: ["$paidAmount", 0] },
              ],
            },
          ],
        },
      },
    };

    const addBalanceStage = {
      $addFields: {
        computed_balance_due: {
          $max: [
            0,
            { $subtract: ["$computed_total_amount", "$computed_paid_amount"] },
          ],
        },
      },
    };

    // Customer Lookup Stage
    const customerLookupStage = {
      $lookup: {
        from: COLLECTIONS.CUSTOMERS,
        let: { custId: { $ifNull: ["$customer_id", "$party_id"] } },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $eq: ["$_id", "$$custId"] },
                  { $eq: [{ $toString: "$_id" }, { $toString: "$$custId" }] },
                ],
              },
            },
          },
          {
            $project: {
              name: 1,
              phone: 1,
              email: 1,
              company_name: 1,
            },
          },
        ],
        as: "customer_doc",
      },
    };

    const addCustomerDetailsStage = {
      $addFields: {
        resolved_customer_name: {
          $ifNull: [
            { $arrayElemAt: ["$customer_doc.name", 0] },
            {
              $ifNull: [
                { $arrayElemAt: ["$customer_doc.company_name", 0] },
                {
                  $ifNull: [
                    "$customer_name",
                    { $ifNull: ["$party_name", "Unknown Party"] },
                  ],
                },
              ],
            },
          ],
        },
        resolved_customer_phone: {
          $ifNull: [{ $arrayElemAt: ["$customer_doc.phone", 0] }, ""],
        },
      },
    };

    // Post-computation Match Filters (Payment Status & Search)
    const postFilterConditions: any[] = [];

    // Payment Status Filter
    if (paymentStatus === "paid") {
      postFilterConditions.push({
        $or: [
          { computed_balance_due: { $lte: 0 } },
          { status: "paid" },
        ],
      });
    } else if (paymentStatus === "unpaid") {
      postFilterConditions.push({
        computed_paid_amount: { $lte: 0 },
        computed_balance_due: { $gt: 0 },
        status: { $ne: "paid" },
      });
    } else if (paymentStatus === "partial") {
      postFilterConditions.push({
        computed_paid_amount: { $gt: 0 },
        computed_balance_due: { $gt: 0 },
        status: { $ne: "paid" },
      });
    }

    // Search Filter
    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), "i");
      postFilterConditions.push({
        $or: [
          { invoice_no: searchRegex },
          { invoiceNo: searchRegex },
          { order_id: searchRegex },
          { resolved_customer_name: searchRegex },
          { customer_notes: searchRegex },
          { notes: searchRegex },
          { "items.name": searchRegex },
          { "items.product_name": searchRegex },
        ],
      });
    }

    const postMatchStage = postFilterConditions.length > 0
      ? [{ $match: { $and: postFilterConditions } }]
      : [];

    // Sort Mapping
    const sortFieldMap: Record<string, string> = {
      invoice_date: "effective_date",
      date: "effective_date",
      sale_date: "effective_date",
      created_at: "effective_date",
      total_amount: "computed_total_amount",
      paid_amount: "computed_paid_amount",
      balance_due: "computed_balance_due",
      customer_name: "resolved_customer_name",
      invoice_number: "invoice_no",
    };
    const sortField = sortFieldMap[sortBy] || "effective_date";

    // Summary Pipeline
    const summaryPipeline: any[] = [
      { $match: matchQuery },
      addFieldsStage,
      addBalanceStage,
      customerLookupStage,
      addCustomerDetailsStage,
      ...postMatchStage,
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$computed_total_amount" },
          totalReceived: { $sum: "$computed_paid_amount" },
          totalBalanceDue: { $sum: "$computed_balance_due" },
          totalInvoicesCount: { $sum: 1 },
          totalItemsSold: {
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
                    { $lte: ["$computed_balance_due", 0] },
                    { $eq: ["$status", "paid"] },
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
                    { $lte: ["$computed_paid_amount", 0] },
                    { $gt: ["$computed_balance_due", 0] },
                    { $ne: ["$status", "paid"] },
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
                    { $gt: ["$computed_paid_amount", 0] },
                    { $gt: ["$computed_balance_due", 0] },
                    { $ne: ["$status", "paid"] },
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
      addBalanceStage,
      customerLookupStage,
      addCustomerDetailsStage,
      ...postMatchStage,
      { $sort: { [sortField]: sortOrder, _id: 1 } },
    ];

    if (skip > 0) {
      dataPipeline.push({ $skip: skip });
    }
    if (limit > 0) {
      dataPipeline.push({ $limit: limit });
    }

    // Run parallel aggregation
    const [summaryResult, invoicesDocs] = await Promise.all([
      ordersCollection.aggregate(summaryPipeline).toArray(),
      ordersCollection.aggregate(dataPipeline).toArray(),
    ]);

    const rawSummary = summaryResult[0] || {};
    const totalSales = rawSummary.totalSales || 0;
    const totalInvoicesCount = rawSummary.totalInvoicesCount || 0;
    const averageInvoiceValue = totalInvoicesCount > 0 ? totalSales / totalInvoicesCount : 0;

    const summary = {
      totalSales,
      totalReceived: rawSummary.totalReceived || 0,
      totalBalanceDue: rawSummary.totalBalanceDue || 0,
      totalInvoicesCount,
      totalItemsSold: rawSummary.totalItemsSold || 0,
      averageInvoiceValue,
      fullyPaidCount: rawSummary.fullyPaidCount || 0,
      unpaidCount: rawSummary.unpaidCount || 0,
      partialCount: rawSummary.partialCount || 0,
    };

    // Format invoices
    const formattedInvoices = invoicesDocs.map((order: any) => {
      const paid = Number(order.computed_paid_amount) || 0;
      const total = Number(order.computed_total_amount) || 0;
      const balance = Number(order.computed_balance_due) ?? Math.max(0, total - paid);
      const isPaid = Boolean(order.status === "paid" || balance <= 0);

      let status: "paid" | "partial" | "unpaid" = "unpaid";
      if (isPaid || balance <= 0) {
        status = "paid";
      } else if (paid > 0 && balance > 0) {
        status = "partial";
      }

      const items = Array.isArray(order.items)
        ? order.items.map((i: any) => ({
            product_id: i.product_id?.toString() || i.id?.toString() || "",
            product_name: i.name || i.product_name || "Item",
            quantity: Number(i.quantity) || 1,
            unit_price: Number(i.price || i.sell_price || i.rate || i.unit_price) || 0,
            discount: Number(i.discount) || 0,
            amount: Number(i.amount || i.total) || (Number(i.quantity || 1) * Number(i.price || 0)),
          }))
        : [];

      const invoiceDate =
        order.sale_date ||
        order.order_date ||
        order.date ||
        order.created_at ||
        new Date().toISOString();

      // Resolve payment method name
      let paymentMethodName = "-";
      const rawMethod = order.payment?.method;
      if (rawMethod) {
        const methodStr = rawMethod.toString();
        if (paymentMethodMap.has(methodStr)) {
          paymentMethodName = paymentMethodMap.get(methodStr)!;
        } else if (methodStr.toLowerCase() === "cash") {
          paymentMethodName = "Cash";
        } else if (methodStr.toLowerCase() === "cheque") {
          paymentMethodName = "Cheque";
        } else {
          paymentMethodName = methodStr;
        }
      } else if (paid > 0) {
        paymentMethodName = "Direct";
      }

      const invoiceNumber =
        order.invoice_no ||
        order.invoiceNo ||
        order.order_id ||
        `INV-${order._id.toString().slice(-6).toUpperCase()}`;

      return {
        id: order._id.toString(),
        invoice_number: invoiceNumber,
        customer_id: (order.customer_id || order.party_id)?.toString() || "",
        customer_name: order.resolved_customer_name || "Unknown Party",
        customer_phone: order.resolved_customer_phone || "",
        total_amount: total,
        paid_amount: paid,
        balance_due: balance,
        is_paid: isPaid,
        status,
        payment_method_name: paymentMethodName,
        notes: order.customer_notes || order.notes || "",
        items_count: items.length,
        items,
        invoice_date: invoiceDate,
        created_at: invoiceDate,
      };
    });

    await updateUserLastActivity();

    return NextResponse.json({
      summary,
      invoices: formattedInvoices,
      pagination: {
        total: totalInvoicesCount,
        page,
        limit: limit > 0 ? limit : totalInvoicesCount,
        totalPages: limit > 0 ? Math.ceil(totalInvoicesCount / limit) : 1,
      },
    });
  } catch (error: any) {
    console.error("Error in sale-report API:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate sale report" },
      { status: 500 }
    );
  }
}
