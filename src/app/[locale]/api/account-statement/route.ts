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
      amount: order.total_amount ?? 0,
      invoiceNo: order.invoice_no || null,
      dateTime:
        order.created_at?.toISOString?.() ||
        order.created_at ||
        order.sale_date?.toISOString?.() ||
        order.sale_date ||
        "",
    }));

    // Extract payments embedded inside orders (payment made at order time)
    const embeddedPaymentRecords = orders
      .filter(
        (order) =>
          order.payment &&
          !order.payment.no_payment_at_all &&
          typeof order.payment.paid_amount === "number" &&
          order.payment.paid_amount > 0,
      )
      .map((order) => {
        // Use paid_date if available, otherwise fall back to order's created_at
        const paidDate =
          order.payment.paid_date?.toISOString?.() ||
          order.payment.paid_date ||
          order.created_at?.toISOString?.() ||
          order.created_at ||
          "";
        return {
          id: order._id.toString() + "_payment",
          type: "payment_in" as const,
          amount: order.payment.paid_amount as number,
          invoiceNo: null,
          dateTime: paidDate,
        };
      });

    // Transform payment-in records into statement records
    // Use created_at for exact transaction time; date is only a user-chosen date with no time component
    const paymentRecords = payments.map((payment) => ({
      id: payment._id.toString(),
      type: "payment_in" as const,
      amount: payment.payment_amount ?? 0,
      invoiceNo: null,
      dateTime:
        payment.created_at?.toISOString?.() ||
        payment.created_at ||
        payment.date?.toISOString?.() ||
        payment.date ||
        "",
    }));

    // Combine and sort by date descending (latest first)
    const allRecords = [
      ...orderRecords,
      ...embeddedPaymentRecords,
      ...paymentRecords,
    ].sort((a, b) => {
      const dateA = new Date(a.dateTime).getTime();
      const dateB = new Date(b.dateTime).getTime();
      return dateA - dateB; // ascending by date for balance calculation
    });

    // Calculate running balance
    // Walk through chronologically and compute balance
    let runningBalance = 0;
    const recordsWithBalance = allRecords.map((record) => {
      if (record.type === "order") {
        runningBalance += record.amount;
      } else if (record.type === "payment_in") {
        runningBalance -= record.amount;
      }
      return {
        ...record,
        balance: runningBalance,
      };
    });

    // Reverse to descending order (latest first) for display
    recordsWithBalance.reverse();

    // Total payments = separate customer_transactions + embedded order payments
    const totalPaymentAmount =
      paymentRecords.reduce((sum, r) => sum + r.amount, 0) +
      embeddedPaymentRecords.reduce((sum, r) => sum + r.amount, 0);

    return NextResponse.json({
      transactions: recordsWithBalance,
      summary: {
        totalOrders: orderRecords.reduce((sum, r) => sum + r.amount, 0),
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
