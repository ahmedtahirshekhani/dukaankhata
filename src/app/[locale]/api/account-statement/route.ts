import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/utils";
import {
  getCollection,
  COLLECTIONS,
  toObjectId,
  isValidObjectId,
} from "@/lib/db/mongodb";

export async function GET(request: NextRequest) {
  try {
    const user = (await getCurrentUser()) as { id: string } | null;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const openingBalanceParam = searchParams.get("openingBalance");

    if (!customerId || !isValidObjectId(customerId)) {
      return NextResponse.json(
        { error: "Valid customer ID is required" },
        { status: 400 },
      );
    }

    if (!fromDate || !toDate) {
      return NextResponse.json(
        { error: "fromDate and toDate are required" },
        { status: 400 },
      );
    }

    const currentDate = searchParams.get("currentDate");

    const userId = toObjectId(user.id);
    const customerObjId = toObjectId(customerId);
    const from = new Date(fromDate);
    const to = new Date(toDate);
    // Set end of day for toDate to include all records on that day
    to.setHours(23, 59, 59, 999);

    // Use currentDate if provided (for reference / future use)
    const today = currentDate ? new Date(currentDate) : new Date();
    today.setHours(23, 59, 59, 999);

    // Use opening balance from frontend (already have customer data there)
    const openingBalance = openingBalanceParam ? parseFloat(openingBalanceParam) : 0;

    // Fetch customer's created_at for opening balance dateTime
    const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);
    const customer = await customersCollection.findOne(
      { _id: customerObjId, user_id: userId },
      { projection: { created_at: 1 } }
    );
    const customerCreatedAt = customer?.created_at?.toISOString?.() || customer?.created_at || new Date().toISOString();

    // Fetch orders for this customer within date range
    const ordersCollection = await getCollection(COLLECTIONS.ORDERS);
    const orders = await ordersCollection
      .find({
        user_id: userId,
        customer_id: customerObjId,
        $or: [
          {
            sale_date: { $gte: from, $lte: to },
          },
          {
            created_at: { $gte: from, $lte: to },
            sale_date: { $exists: false },
          },
        ],
      })
      .sort({ created_at: -1 })
      .toArray();

    // Fetch payment-in (customer transactions) for this customer within date range
    const customerTransactionsCollection = await getCollection(
      COLLECTIONS.CUSTOMER_TRANSACTIONS,
    );
    const payments = await customerTransactionsCollection
      .find({
        user_id: userId,
        customer_id: customerObjId,
        $or: [
          { date: { $gte: from, $lte: to } },
          {
            created_at: { $gte: from, $lte: to },
            date: { $exists: false },
          },
        ],
      })
      .sort({ date: -1 })
      .toArray();

    // Transform orders into statement records
    // Use created_at for exact transaction time; sale_date is only a user-chosen date with no time component
    const orderRecords = orders.map((order) => ({
      id: order._id.toString(),
      type: "order" as const,
      orderValue: order.total_amount ?? 0,
      paidAmount:
        order.payment &&
        !order.payment.no_payment_at_all &&
        typeof order.payment.paid_amount === "number"
          ? order.payment.paid_amount
          : null,
      invoiceNo: order.invoice_no || null,
      dateTime:
        order.created_at?.toISOString?.() ||
        order.created_at ||
        order.sale_date?.toISOString?.() ||
        order.sale_date ||
        "",
      paidDate:
        order.payment &&
        !order.payment.no_payment_at_all &&
        order.payment.paid_date
          ? order.payment.paid_date.toISOString?.() || order.payment.paid_date
          : null,
    }));

    // Transform payment-in records into statement records (only separate customer payments, not embedded order payments)
    // Use created_at for exact transaction time; date is only a user-chosen date with no time component
    const paymentRecords = payments.map((payment) => ({
      id: payment._id.toString(),
      type: "payment_in" as const,
      orderValue: null,
      paidAmount: payment.payment_amount ?? 0,
      invoiceNo: null,
      dateTime:
        payment.created_at?.toISOString?.() ||
        payment.created_at ||
        payment.date?.toISOString?.() ||
        payment.date ||
        "",
      paidDate:
        payment.date?.toISOString?.() || payment.date || null,
    }));

    // Combine and sort by date descending (latest first)
    const allRecords = [
      ...orderRecords,
      ...paymentRecords,
    ].sort((a, b) => {
      const dateA = new Date(a.dateTime).getTime();
      const dateB = new Date(b.dateTime).getTime();
      return dateA - dateB; // ascending by date for balance calculation
    });

    // Calculate running balance starting from opening balance
    let runningBalance = openingBalance;
    const recordsWithBalance = allRecords.map((record) => {
      if (record.type === "order") {
        runningBalance += record.orderValue || 0;
        if (record.paidAmount) {
          runningBalance -= record.paidAmount;
        }
      } else if (record.type === "payment_in") {
        runningBalance -= record.paidAmount || 0;
      }
      return {
        ...record,
        balance: runningBalance,
      };
    });

    // Reverse to descending order (latest first) for display
    recordsWithBalance.reverse();

    // Always add opening balance as the last entry
    const allTransactions = recordsWithBalance;
    allTransactions.push({
      id: "opening_balance",
      type: "opening_balance" as any,
      orderValue: null,
      paidAmount: null,
      invoiceNo: null,
      dateTime: customerCreatedAt,
      paidDate: null,
      balance: openingBalance,
    });

    // Total payments = customer transactions + paid amounts in orders
    const totalPaymentAmount =
      paymentRecords.reduce((sum, r) => sum + (r.paidAmount || 0), 0) +
      orderRecords.reduce((sum, r) => sum + (r.paidAmount || 0), 0);

    return NextResponse.json({
      transactions: allTransactions,
      summary: {
        openingBalance,
        totalOrders: orderRecords.reduce((sum, r) => sum + (r.orderValue || 0), 0),
        totalPayments: totalPaymentAmount,
        currentBalance: runningBalance,
      },
    });
  } catch (err: unknown) {
    console.error("account-statement GET error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
