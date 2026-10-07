// src/app/[locale]/api/reports/party-wise-report/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS, toObjectId, isValidObjectId } from "@/lib/db/mongodb";
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

    const authCheck = await requirePermission("reports.view_party_wise_sale_purchase_report");
    if (!authCheck.allowed) return authCheck.response!;

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") || "sales"; // "sales" (Sale by Party) | "purchases" (Purchase by Party)
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const partyId = searchParams.get("partyId");
    const search = searchParams.get("search")?.trim() || "";
    const detailsPartyId = searchParams.get("detailsPartyId"); // If set, return that party's individual transactions
    const page = parseInt(searchParams.get("page") || "1");
    const limitParam = searchParams.get("limit");
    const limit = limitParam === "-1" ? 0 : parseInt(limitParam || "10");
    const skip = limit > 0 ? (page - 1) * limit : 0;

    const userObjId = toObjectId(user.id);
    const ordersCollection = await getCollection(COLLECTIONS.ORDERS);
    const purchaseBillsCollection = await getCollection(COLLECTIONS.PURCHASE_BILLS);
    const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);
    const paymentMethodsCollection = await getCollection(COLLECTIONS.PAYMENT_METHODS);

    // Fetch user payment methods map for name resolution
    const paymentMethods = await paymentMethodsCollection
      .find({ user_id: userObjId })
      .project({ _id: 1, bank_name: 1, account_title: 1 })
      .toArray();

    const paymentMethodMap = new Map<string, string>();
    paymentMethods.forEach((pm) => {
      paymentMethodMap.set(pm._id.toString(), pm.bank_name || pm.account_title || "Cash");
    });

    // --- DRILLDOWN DETAILS FOR A SINGLE PARTY ---
    if (detailsPartyId) {
      const partyObjId = isValidObjectId(detailsPartyId) ? toObjectId(detailsPartyId) : null;

      if (mode === "sales") {
        const orderMatch: any = {
          user_id: userObjId,
          is_delete: { $nin: [1, true, "1"] },
          is_deleted: { $nin: [1, true, "1"] },
          isDelete: { $nin: [1, true, "1"] },
          isDeleted: { $ne: true },
          status: { $nin: ["cancelled", "deleted", "inactive", "Cancelled", "Deleted", "Inactive"] },
          $or: [
            { customer_id: detailsPartyId },
            ...(partyObjId ? [{ customer_id: partyObjId }] : []),
            { "customer._id": detailsPartyId },
            ...(partyObjId ? [{ "customer._id": partyObjId }] : []),
          ],
        };

        const invoices = await ordersCollection
          .find(orderMatch)
          .sort({ sale_date: -1, invoice_date: -1, created_at: -1 })
          .limit(100)
          .toArray();

        const mapped = invoices.map((o) => {
          const total = Number(o.total_amount || o.final_amount || o.grand_total || 0);
          const paid = Number(
            o.paid_amount ??
            o.payment?.paid_amount ??
            o.received_amount ??
            0
          );
          const balance = Math.max(0, total - paid);
          const isPaid = balance <= 0 || o.status === "paid";
          const isPartial = paid > 0 && balance > 0;
          const status = isPaid ? "paid" : isPartial ? "partial" : "unpaid";
          const pmId = o.payment_method_id?.toString() || o.payment?.method?.toString() || o.payment_method?.toString();

          const invNum =
            o.invoice_no ||
            o.invoiceNo ||
            o.invoice_number ||
            o.order_id ||
            o.order_number ||
            o.orderNumber ||
            (o._id ? `INV-${o._id.toString().slice(-6).toUpperCase()}` : "-");

          const invDate = o.sale_date || o.invoice_date || o.order_date || o.date || o.created_at;

          return {
            id: o._id.toString(),
            invoice_number: invNum,
            invoice_no: invNum,
            date: invDate,
            total_amount: total,
            paid_amount: paid,
            balance_due: balance,
            status,
            payment_method_name: pmId ? paymentMethodMap.get(pmId) || "Cash" : "Cash",
            items_count: Array.isArray(o.items) ? o.items.length : 0,
          };
        });

        return NextResponse.json({ data: mapped });
      } else {
        // Purchases Drilldown
        const billMatch: any = {
          user_id: userObjId,
          $or: [
            { party_id: detailsPartyId },
            ...(partyObjId ? [{ party_id: partyObjId }] : []),
            { "party._id": detailsPartyId },
            ...(partyObjId ? [{ "party._id": partyObjId }] : []),
          ],
        };

        const bills = await purchaseBillsCollection
          .find(billMatch)
          .sort({ bill_date: -1, created_at: -1 })
          .limit(100)
          .toArray();

        const mapped = bills.map((b) => {
          const total = Number(b.total_amount || b.grand_total || 0);
          const paid = Number(b.paid_amount || 0);
          const balance = Math.max(0, total - paid);
          const isPaid = balance <= 0 || b.status === "paid";
          const isPartial = paid > 0 && balance > 0;
          const status = isPaid ? "paid" : isPartial ? "partial" : "unpaid";
          const pmId = b.payment_method_id?.toString() || b.payment_method?.toString();

          const billNum =
            b.purchase_number ||
            b.purchaseNumber ||
            b.bill_number ||
            b.bill_no ||
            b.billNo ||
            (b._id ? `BILL-${b._id.toString().slice(-6).toUpperCase()}` : "-");

          return {
            id: b._id.toString(),
            bill_number: billNum,
            date: b.bill_date || b.created_at,
            total_amount: total,
            paid_amount: paid,
            balance_due: balance,
            status,
            payment_method_name: pmId ? paymentMethodMap.get(pmId) || "Cash" : "Cash",
            items_count: Array.isArray(b.items) ? b.items.length : 0,
          };
        });

        return NextResponse.json({ data: mapped });
      }
    }

    // --- MODE: SALE BY PARTY ---
    if (mode === "sales") {
      const matchQuery: any = {
        user_id: userObjId,
        is_delete: { $nin: [1, true, "1"] },
        is_deleted: { $nin: [1, true, "1"] },
        isDelete: { $nin: [1, true, "1"] },
        isDeleted: { $ne: true },
        status: { $nin: ["cancelled", "deleted", "inactive", "Cancelled", "Deleted", "Inactive"] },
      };

      if (partyId && partyId !== "all") {
        const partyObjId = isValidObjectId(partyId) ? toObjectId(partyId) : null;
        matchQuery.$or = [
          { customer_id: partyId },
          ...(partyObjId ? [{ customer_id: partyObjId }] : []),
          { "customer._id": partyId },
          ...(partyObjId ? [{ "customer._id": partyObjId }] : []),
        ];
      }

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
                      "$invoice_date",
                      { $ifNull: ["$sale_date", { $ifNull: ["$date", "$created_at"] }] },
                    ],
                  },
                },
                in: {
                  $and: [
                    { $gte: [{ $toDate: "$$rawDate" }, from] },
                    { $lte: [{ $toDate: "$$rawDate" }, to] },
                  ],
                },
              },
            },
          });
        }
      }

      // Group sales by Customer
      const groupedSales = await ordersCollection
        .aggregate([
          { $match: matchQuery },
          {
            $group: {
              _id: { $toString: "$customer_id" },
              customer_name: { $first: "$customer_name" },
              customer_phone: { $first: "$customer_phone" },
              total_sales: { $sum: { $toDouble: { $ifNull: ["$total_amount", "$final_amount", 0] } } },
              total_received: { $sum: { $toDouble: { $ifNull: ["$paid_amount", "$received_amount", 0] } } },
              invoices_count: { $sum: 1 },
              last_date: {
                $max: {
                  $ifNull: [
                    "$invoice_date",
                    { $ifNull: ["$sale_date", { $ifNull: ["$date", "$created_at"] }] },
                  ],
                },
              },
            },
          },
        ])
        .toArray();

      // Fetch customer metadata for phone / proper name if missing
      const customerIds = groupedSales.map((s) => s._id).filter(Boolean);
      const customerMetaList = await customersCollection
        .find({
          user_id: userObjId,
          _id: { $in: customerIds.map((id) => (isValidObjectId(id) ? toObjectId(id) : id)) },
        })
        .project({ _id: 1, name: 1, phone: 1 })
        .toArray();

      const customerMetaMap = new Map<string, any>();
      customerMetaList.forEach((c) => customerMetaMap.set(c._id.toString(), c));

      let rows = groupedSales.map((item) => {
        const meta = customerMetaMap.get(item._id);
        const name = item.customer_name || meta?.name || "Walk-in Customer";
        const phone = item.customer_phone || meta?.phone || "-";
        const totalSales = Number(item.total_sales || 0);
        const received = Number(item.total_received || 0);
        const balance = Math.max(0, totalSales - received);

        return {
          party_id: item._id || "unknown",
          party_name: name,
          party_phone: phone,
          total_amount: totalSales,
          paid_amount: received,
          balance_due: balance,
          transactions_count: Number(item.invoices_count || 0),
          last_date: item.last_date || null,
        };
      });

      // Search filter
      if (search) {
        const q = search.toLowerCase();
        rows = rows.filter(
          (r) => r.party_name.toLowerCase().includes(q) || r.party_phone.toLowerCase().includes(q)
        );
      }

      // Sort by total sale amount descending
      rows.sort((a, b) => b.total_amount - a.total_amount);

      // KPIs
      let totalAmount = 0;
      let totalPaid = 0;
      let totalBalanceDue = 0;
      let totalTransactionsCount = 0;

      rows.forEach((r) => {
        totalAmount += r.total_amount;
        totalPaid += r.paid_amount;
        totalBalanceDue += r.balance_due;
        totalTransactionsCount += r.transactions_count;
      });

      const totalPartiesCount = rows.length;
      const paginatedRows = limit > 0 ? rows.slice(skip, skip + limit) : rows;

      return NextResponse.json({
        data: paginatedRows,
        summary: {
          totalAmount,
          totalPaid,
          totalBalanceDue,
          totalPartiesCount,
          totalTransactionsCount,
        },
        pagination: {
          total: totalPartiesCount,
          page,
          limit,
          totalPages: limit > 0 ? Math.ceil(totalPartiesCount / limit) : 1,
        },
      });
    }

    // --- MODE: PURCHASE BY PARTY ---
    if (mode === "purchases") {
      const matchQuery: any = {
        user_id: userObjId,
      };

      if (partyId && partyId !== "all") {
        const partyObjId = isValidObjectId(partyId) ? toObjectId(partyId) : null;
        matchQuery.$or = [
          { party_id: partyId },
          ...(partyObjId ? [{ party_id: partyObjId }] : []),
          { "party._id": partyId },
          ...(partyObjId ? [{ "party._id": partyObjId }] : []),
        ];
      }

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
                      { $ifNull: ["$purchase_date", { $ifNull: ["$date", "$created_at"] }] },
                    ],
                  },
                },
                in: {
                  $and: [
                    { $gte: [{ $toDate: "$$rawDate" }, from] },
                    { $lte: [{ $toDate: "$$rawDate" }, to] },
                  ],
                },
              },
            },
          });
        }
      }

      // Group purchases by Supplier/Party
      const groupedPurchases = await purchaseBillsCollection
        .aggregate([
          { $match: matchQuery },
          {
            $group: {
              _id: { $toString: "$party_id" },
              party_name: { $first: "$party_name" },
              total_purchases: { $sum: { $toDouble: { $ifNull: ["$total_amount", 0] } } },
              total_paid: { $sum: { $toDouble: { $ifNull: ["$paid_amount", 0] } } },
              bills_count: { $sum: 1 },
              last_date: {
                $max: {
                  $ifNull: [
                    "$bill_date",
                    { $ifNull: ["$purchase_date", { $ifNull: ["$date", "$created_at"] }] },
                  ],
                },
              },
            },
          },
        ])
        .toArray();

      // Fetch party phone from customers collection
      const partyIds = groupedPurchases.map((p) => p._id).filter(Boolean);
      const partyMetaList = await customersCollection
        .find({
          user_id: userObjId,
          _id: { $in: partyIds.map((id) => (isValidObjectId(id) ? toObjectId(id) : id)) },
        })
        .project({ _id: 1, name: 1, phone: 1 })
        .toArray();

      const partyMetaMap = new Map<string, any>();
      partyMetaList.forEach((c) => partyMetaMap.set(c._id.toString(), c));

      let rows = groupedPurchases.map((item) => {
        const meta = partyMetaMap.get(item._id);
        const name = item.party_name || meta?.name || "Supplier";
        const phone = meta?.phone || "-";
        const totalPurchases = Number(item.total_purchases || 0);
        const paid = Number(item.total_paid || 0);
        const balance = Math.max(0, totalPurchases - paid);

        return {
          party_id: item._id || "unknown",
          party_name: name,
          party_phone: phone,
          total_amount: totalPurchases,
          paid_amount: paid,
          balance_due: balance,
          transactions_count: Number(item.bills_count || 0),
          last_date: item.last_date || null,
        };
      });

      // Search filter
      if (search) {
        const q = search.toLowerCase();
        rows = rows.filter(
          (r) => r.party_name.toLowerCase().includes(q) || r.party_phone.toLowerCase().includes(q)
        );
      }

      // Sort by total purchase amount descending
      rows.sort((a, b) => b.total_amount - a.total_amount);

      // KPIs
      let totalAmount = 0;
      let totalPaid = 0;
      let totalBalanceDue = 0;
      let totalTransactionsCount = 0;

      rows.forEach((r) => {
        totalAmount += r.total_amount;
        totalPaid += r.paid_amount;
        totalBalanceDue += r.balance_due;
        totalTransactionsCount += r.transactions_count;
      });

      const totalPartiesCount = rows.length;
      const paginatedRows = limit > 0 ? rows.slice(skip, skip + limit) : rows;

      return NextResponse.json({
        data: paginatedRows,
        summary: {
          totalAmount,
          totalPaid,
          totalBalanceDue,
          totalPartiesCount,
          totalTransactionsCount,
        },
        pagination: {
          total: totalPartiesCount,
          page,
          limit,
          totalPages: limit > 0 ? Math.ceil(totalPartiesCount / limit) : 1,
        },
      });
    }

    return NextResponse.json({ error: "Invalid mode. Use 'sales' or 'purchases'." }, { status: 400 });
  } catch (error: any) {
    console.error("Error in party-wise report API:", error);
    return NextResponse.json(
      { error: "Failed to generate report", details: error.message },
      { status: 500 }
    );
  }
}
