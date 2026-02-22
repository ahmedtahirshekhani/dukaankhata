import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/utils";
import {
  getCollection,
  COLLECTIONS,
  toObjectId,
  isValidObjectId,
} from "@/lib/db/mongodb";
import {
  calculateRunningBalance,
  calculateSummary,
  toISOString,
  parseStatementParams,
  sortRecordsChronologically,
} from "@/lib/account-statement";

/**
 * Validates required parameters for account statement generation
 */
function validateParams(customerId: string | null, fromDate: string | null, toDate: string | null) {
  if (!customerId || !isValidObjectId(customerId)) {
    return { valid: false, error: "Valid customer ID is required", status: 400 };
  }
  if (!fromDate || !toDate) {
    return { valid: false, error: "fromDate and toDate are required", status: 400 };
  }
  return { valid: true };
}

/**
 * Prepares date range for database queries
 */
function prepareDateRange(fromDate: string, toDate: string) {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

/**
 * Fetches and transforms order records
 */
async function fetchOrderRecords(
  ordersCollection: any,
  userId: any,
  customerObjId: any,
  from: Date,
  to: Date
) {
  const orders = await ordersCollection
    .find({
      user_id: userId,
      customer_id: customerObjId,
      $or: [
        { sale_date: { $gte: from, $lte: to } },
        {
          created_at: { $gte: from, $lte: to },
          sale_date: { $exists: false },
        },
      ],
    })
    .sort({ created_at: -1 })
    .toArray();

  return orders.map((order: any) => ({
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
    dateTime: toISOString(order.created_at || order.sale_date || ""),
    paidDate:
      order.payment &&
      !order.payment.no_payment_at_all &&
      order.payment.paid_date
        ? toISOString(order.payment.paid_date)
        : null,
  }));
}

/**
 * Fetches and transforms payment records
 */
async function fetchPaymentRecords(
  paymentsCollection: any,
  userId: any,
  customerObjId: any,
  from: Date,
  to: Date
) {
  const payments = await paymentsCollection
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

  return payments.map((payment: any) => ({
    id: payment._id.toString(),
    type: "payment_in" as const,
    orderValue: null,
    paidAmount: payment.payment_amount ?? 0,
    invoiceNo: null,
    dateTime: toISOString(payment.created_at || payment.date || ""),
    paidDate: toISOString(payment.date) || null,
  }));
}



export async function GET(request: NextRequest) {
  try {
    const user = (await getCurrentUser()) as { id: string } | null;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const params = parseStatementParams(searchParams);

    // Validate parameters
    const validation = validateParams(params.customerId, params.fromDate, params.toDate);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const userId = toObjectId(user.id);
    const customerObjId = toObjectId(params.customerId!);
    const { from, to } = prepareDateRange(params.fromDate!, params.toDate!);

    // Fetch customer's created_at for opening balance dateTime
    const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);
    const customer = await customersCollection.findOne(
      { _id: customerObjId, user_id: userId },
      { projection: { created_at: 1 } }
    );
    const customerCreatedAt = toISOString(customer?.created_at || new Date().toISOString());

    // Fetch orders and payments in parallel for better performance
    const ordersCollection = await getCollection(COLLECTIONS.ORDERS);
    const paymentsCollection = await getCollection(COLLECTIONS.CUSTOMER_TRANSACTIONS);

    const [orderRecords, paymentRecords] = await Promise.all([
      fetchOrderRecords(ordersCollection, userId, customerObjId, from, to),
      fetchPaymentRecords(paymentsCollection, userId, customerObjId, from, to),
    ]);

    // Combine and sort records chronologically
    const allRecords = sortRecordsChronologically([...orderRecords, ...paymentRecords]);

    // Calculate running balance
    const balanceData = calculateRunningBalance(allRecords as any, params.openingBalance);
    const recordsWithBalance = allRecords.map((record, idx) => ({
      ...record,
      balance: balanceData[idx].balance,
    }));

    // Reverse for latest-first display
    recordsWithBalance.reverse();

    // Always add opening balance as the last entry
    const finalBalance =
      recordsWithBalance.length > 0
        ? recordsWithBalance[0].balance
        : params.openingBalance;

    const openingBalanceRecord = {
      id: "opening_balance" as const,
      type: "opening_balance" as const,
      orderValue: null,
      paidAmount: null,
      invoiceNo: null,
      dateTime: customerCreatedAt,
      paidDate: null,
      balance: params.openingBalance,
    };
    recordsWithBalance.push(openingBalanceRecord);

    // Calculate summary
    const summary = calculateSummary(
      orderRecords,
      paymentRecords,
      params.openingBalance,
      finalBalance
    );

    return NextResponse.json({
      transactions: recordsWithBalance,
      summary,
    });
  } catch (err: unknown) {
    console.error("account-statement GET error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
