import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth/utils";
import { requirePermission } from "@/lib/auth/rbac";
import {
  getCollection,
  COLLECTIONS,
  toObjectId,
  isValidObjectId,
  updateUserLastActivity,
} from "@/lib/db/mongodb";
import { safeDate } from "@/lib/date-utils";

type LedgerEntryDoc = {
  _id: ObjectId;
  user_id: ObjectId;
  party_id?: ObjectId;
  customer_id?: ObjectId;
  event_key: string;
  event_type: string;
  event_source: string;
  event_source_id: ObjectId | string | null;
  amount_delta: number;
  effective_at: Date;
  running_balance?: number;
  created_at?: Date;
  metadata?: Record<string, unknown> | null;
};

function asISO(value: unknown): string {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return isNaN(value.getTime()) ? new Date().toISOString() : value.toISOString();
  if (typeof value === "string") {
    const d = parseDocDate(value);
    return d ? d.toISOString() : value;
  }
  if (typeof (value as { toISOString?: () => string })?.toISOString === "function") {
    return (value as { toISOString: () => string }).toISOString();
  }
  const d = new Date(value as string | number);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function parseDocDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const d = safeDate(val as string, new Date(0));
  return d.getTime() === 0 ? null : d;
}

function parseDateRange(fromDate: string, toDate: string) {
  const fDate = safeDate(fromDate);
  const tDate = safeDate(toDate);

  if (isNaN(fDate.getTime()) || isNaN(tDate.getTime())) {
    throw new Error("Invalid date range");
  }

  const from = new Date(fDate.getFullYear(), fDate.getMonth(), fDate.getDate(), 0, 0, 0, 0);
  const to = new Date(tDate.getFullYear(), tDate.getMonth(), tDate.getDate(), 23, 59, 59, 999);

  if (from.getTime() > to.getTime()) {
    throw new Error("fromDate cannot be greater than toDate");
  }

  return { from, to };
}

function validateParams(
  customerId: string | null,
  fromDate: string | null,
  toDate: string | null
) {
  if (!customerId || !isValidObjectId(customerId)) {
    return { valid: false, error: "Valid customer ID is required", status: 400 };
  }
  if (!fromDate || !toDate) {
    return { valid: false, error: "fromDate and toDate are required", status: 400 };
  }
  return { valid: true as const };
}

export async function GET(request: NextRequest) {
  try {
    const user = (await getCurrentUser()) as { id: string } | null;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requirePermission("reports.view_account_statement");
    if (!authCheck.allowed) return authCheck.response!;

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    const validation = validateParams(customerId, fromDate, toDate);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status }
      );
    }

    const userId = toObjectId(user.id);
    const customerObjId = toObjectId(customerId!);
    const { from, to } = parseDateRange(fromDate!, toDate!);

    const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);
    const usersCollection = await getCollection(COLLECTIONS.USERS);
    const ordersCollection = await getCollection(COLLECTIONS.ORDERS);
    const paymentsCollection = await getCollection(COLLECTIONS.CUSTOMER_TRANSACTIONS);
    const purchaseBillsCollection = await getCollection(COLLECTIONS.PURCHASE_BILLS);
    const saleReturnsCollection = await getCollection(COLLECTIONS.SALE_RETURN_TRANSACTIONS);
    const paymentMethodsCollection = await getCollection(COLLECTIONS.PAYMENT_METHODS);
    const ledgerCollection = await getCollection<LedgerEntryDoc>(COLLECTIONS.PARTY_LEDGER_ENTRIES);

    const partyMatchFilter = {
      $or: [
        { customer_id: customerObjId },
        { party_id: customerObjId },
        { customer_id: customerId! },
        { party_id: customerId! },
      ],
    };

    const vendorMatchFilter = {
      $or: [
        { customer_id: customerObjId },
        { party_id: customerObjId },
        { vendor_id: customerObjId },
        { customer_id: customerId! },
        { party_id: customerId! },
        { vendor_id: customerId! },
      ],
    };

    // Parallel fetch of customer, user, payment methods, and all active source documents
    const [
      customer,
      userDoc,
      paymentMethodsDocs,
      orderDocs,
      paymentDocs,
      saleReturnDocs,
      purchaseBillDocs,
      manualAdjustmentDocs,
    ] = await Promise.all([
      customersCollection.findOne(
        { _id: customerObjId, user_id: userId },
        {
          projection: {
            created_at: 1,
            opening_balance: 1,
            name: 1,
            company_name: 1,
            company_address: 1,
          },
        }
      ),
      usersCollection.findOne(
        { _id: userId },
        { projection: { company_name: 1, company_address: 1, company_logo: 1 } }
      ),
      paymentMethodsCollection.find({ user_id: userId }).toArray(),
      ordersCollection
        .find({
          user_id: userId,
          ...partyMatchFilter,
          status: { $ne: "cancelled" },
          is_delete: { $ne: 1 },
        })
        .toArray(),
      paymentsCollection
        .find({
          user_id: userId,
          ...partyMatchFilter,
          is_delete: { $ne: 1 },
        })
        .toArray(),
      saleReturnsCollection
        .find({
          user_id: userId,
          ...partyMatchFilter,
          is_delete: { $ne: 1 },
        })
        .toArray(),
      purchaseBillsCollection
        .find({
          user_id: userId,
          ...vendorMatchFilter,
          is_delete: { $ne: 1 },
        })
        .toArray(),
      ledgerCollection
        .find({
          user_id: userId,
          ...partyMatchFilter,
          event_type: "manual_adjustment",
        })
        .toArray(),
    ]);

    const paymentMethodMap = new Map<string, string>([
      ["cash", "Cash"],
      ["cheque", "Cheque"],
      ...paymentMethodsDocs.map((pm: any) => [pm._id.toString(), pm.bank_name || ""] as [string, string]),
    ]);

    type UnifiedTxn = {
      id: string;
      type: string;
      description: string;
      items: any[];
      amount: number;
      debit: number;
      credit: number;
      orderId: string | null;
      dateTime: string;
      docDate: Date;
    };

    const allTransactions: UnifiedTxn[] = [];

    // 1. Process Orders / Sales
    for (const order of orderDocs) {
      const docDate =
        parseDocDate(order.sale_date) ||
        parseDocDate(order.order_date) ||
        parseDocDate(order.date) ||
        parseDocDate(order.created_at) ||
        new Date();

      const totalAmount = Number(order.total_amount ?? 0);
      const paidAmount = Number(order.payment?.paid_amount ?? 0);
      const balanceDue = Math.max(0, totalAmount - paidAmount);
      const items = Array.isArray(order.items) ? order.items : [];
      const expandedItems = items.map((item: any) => {
        const qty = parseFloat(item.quantity) || 0;
        const prc = parseFloat(item.price ?? item.sell_price) || 0;
        return {
          name: item.name || item.product_name || "Item",
          quantity: qty,
          price: prc,
          amount: parseFloat(item.total || item.amount) || qty * prc,
          uom: item.uom || item.unit || "",
        };
      });

      const invoiceNo = order.invoice_no || order.invoiceNo || order.order_id || order._id.toString();

      allTransactions.push({
        id: order._id.toString(),
        type: "order",
        description: "SALES",
        items: expandedItems,
        amount: totalAmount,
        debit: balanceDue,
        credit: 0,
        orderId: invoiceNo,
        dateTime: asISO(docDate),
        docDate,
      });
    }

    // 2. Process Sale Returns
    for (const sr of saleReturnDocs) {
      const docDate =
        parseDocDate(sr.date) ||
        parseDocDate(sr.created_at) ||
        new Date();

      const totalAmount = Number(sr.total_amount ?? sr.payment_amount ?? 0);
      const refundAmount = Number(sr.paid_amount ?? sr.refund_amount ?? 0);
      const balanceDue = Math.max(0, totalAmount - refundAmount);
      const returnNo = sr.return_number || sr.returnNumber || sr._id.toString();
      const srItems = Array.isArray(sr.items) ? sr.items : [];
      const expandedItems = srItems.map((item: any) => {
        const qty = parseFloat(item.quantity) || 0;
        const prc = parseFloat(item.rate ?? item.price ?? item.cost_price ?? 0);
        return {
          name: item.itemName || item.name || item.product_name || "Item",
          quantity: qty,
          price: prc,
          amount: parseFloat(item.amount) || qty * prc,
          uom: item.uom || item.unit || "",
        };
      });

      allTransactions.push({
        id: sr._id.toString(),
        type: "sale_return",
        description: "SALE RETURN (Credit Note)",
        items: expandedItems,
        amount: totalAmount,
        debit: 0,
        credit: balanceDue,
        orderId: returnNo,
        dateTime: asISO(docDate),
        docDate,
      });
    }

    // 3. Process Purchase Bills
    for (const bill of purchaseBillDocs) {
      const docDate =
        parseDocDate(bill.bill_date) ||
        parseDocDate(bill.purchase_date) ||
        parseDocDate(bill.date) ||
        parseDocDate(bill.created_at) ||
        new Date();

      const totalAmount = Number(bill.total_amount ?? 0);
      const paidAmount = Number(bill.paid_amount ?? 0);
      const balanceDue = Math.max(0, totalAmount - paidAmount);
      const billNo =
        bill.purchase_number ||
        bill.purchase_no ||
        bill.bill_number ||
        bill._id.toString();
      const billItems = Array.isArray(bill.items) ? bill.items : [];
      const expandedItems = billItems.map((item: any) => {
        const qty = parseFloat(item.quantity) || 0;
        const prc = parseFloat(item.cost_price ?? item.price) || 0;
        return {
          name: item.product_name || item.name || "Item",
          quantity: qty,
          price: prc,
          amount: parseFloat(item.amount) || qty * prc,
          uom: item.uom || item.unit || "",
        };
      });

      allTransactions.push({
        id: bill._id.toString(),
        type: "purchase_bill",
        description: "PURCHASE BILL",
        items: expandedItems,
        amount: totalAmount,
        debit: 0,
        credit: balanceDue,
        orderId: billNo,
        dateTime: asISO(docDate),
        docDate,
      });
    }

    // 4. Process Payment In / Payment Out
    for (const payment of paymentDocs) {
      const docDate =
        parseDocDate(payment.date) ||
        parseDocDate(payment.created_at) ||
        new Date();

      const paymentAmount = Number(payment.payment_amount ?? 0);
      const isPaymentIn =
        payment.type === "payment-in" ||
        payment.type === "payment_in";

      const methodId = payment.payment_method_id?.toString() || "";
      const methodName = paymentMethodMap.get(methodId) || (payment.payment_method ? String(payment.payment_method) : "Cash");
      const paymentNo = payment.payment_number || payment.paymentNumber || payment._id.toString();

      const description = isPaymentIn
        ? (methodName ? `Payment Received (${methodName})` : "Payment Received")
        : (methodName ? `Payment Out (${methodName})` : "Payment Out");

      allTransactions.push({
        id: payment._id.toString(),
        type: isPaymentIn ? "payment_in" : "payment_out",
        description,
        items: [],
        amount: paymentAmount,
        debit: isPaymentIn ? 0 : paymentAmount,
        credit: isPaymentIn ? paymentAmount : 0,
        orderId: paymentNo,
        dateTime: asISO(docDate),
        docDate,
      });
    }

    // 5. Process Manual Adjustments (excluding system reversals/edits/deletions)
    for (const adj of manualAdjustmentDocs) {
      const eventKey = (adj.event_key || "").toLowerCase();
      const metadata = (adj.metadata as any) || {};
      const reason = (metadata.reason || "").toString().toLowerCase();

      if (
        eventKey.includes("reversal") ||
        eventKey.includes("reverse") ||
        eventKey.includes("delete") ||
        eventKey.includes("update") ||
        reason.includes("reversal") ||
        reason.includes("reverse") ||
        reason.includes("deleted")
      ) {
        continue;
      }

      const docDate =
        parseDocDate(adj.effective_at) ||
        parseDocDate(adj.created_at) ||
        new Date();

      const amountDelta = Number(adj.amount_delta || 0);
      const debit = amountDelta > 0 ? Math.abs(amountDelta) : 0;
      const credit = amountDelta < 0 ? Math.abs(amountDelta) : 0;

      allTransactions.push({
        id: adj._id.toString(),
        type: "adjustment",
        description: metadata.description || metadata.reason || "Manual Adjustment",
        items: [],
        amount: Math.abs(amountDelta),
        debit,
        credit,
        orderId: null,
        dateTime: asISO(docDate),
        docDate,
      });
    }

    // Calculate base opening balance from customer profile
    const baseOpeningBalance = Number(customer?.opening_balance ?? 0);

    // Partition transactions into:
    // 1. Prior to `from` -> accumulates into `openingBalance`
    // 2. In range `[from, to]` -> statement transactions
    let calculatedOpeningBalance = baseOpeningBalance;
    const inRangeTransactions: UnifiedTxn[] = [];

    const fromTime = from.getTime();
    const toTime = to.getTime();

    for (const txn of allTransactions) {
      const txnTime = txn.docDate.getTime();
      if (txnTime < fromTime) {
        calculatedOpeningBalance += (txn.debit - txn.credit);
      } else if (txnTime <= toTime) {
        inRangeTransactions.push(txn);
      }
    }

    // Sort range transactions chronologically
    inRangeTransactions.sort((a, b) => a.docDate.getTime() - b.docDate.getTime());

    // Calculate running balances
    let runningBalance = calculatedOpeningBalance;
    const transactions = inRangeTransactions
      .filter((t) => t.debit > 0 || t.credit > 0 || Math.abs(t.debit - t.credit) >= 0.01)
      .map((t) => {
        runningBalance += (t.debit - t.credit);
        return {
          id: t.id,
          type: t.type,
          description: t.description,
          items: t.items,
          amount: t.amount,
          debit: t.debit,
          credit: t.credit,
          orderId: t.orderId,
          dateTime: t.dateTime,
          balance: runningBalance,
        };
      });

    // Opening Balance virtual row
    const openingDate = from.toISOString();
    const openingBalanceRecord = {
      id: "opening_balance",
      type: "opening_balance",
      description: "Opening Balance",
      items: [],
      amount: Math.abs(calculatedOpeningBalance),
      debit: calculatedOpeningBalance > 0 ? Math.abs(calculatedOpeningBalance) : 0,
      credit: calculatedOpeningBalance < 0 ? Math.abs(calculatedOpeningBalance) : 0,
      orderId: null,
      dateTime: openingDate,
      balance: calculatedOpeningBalance,
    };

    const totalOrders = transactions
      .filter((t) => t.type === "order")
      .reduce((sum, t) => sum + (t.amount || t.debit || 0), 0);

    const totalPurchaseBills = transactions
      .filter((t) => t.type === "purchase_bill")
      .reduce((sum, t) => sum + (t.amount || t.credit || 0), 0);

    const totalPaymentsIn = transactions
      .filter((t) => t.type === "payment_in" || t.type === "sale_return")
      .reduce((sum, t) => sum + (t.credit || 0), 0);

    const totalPaymentsOut = transactions
      .filter((t) => t.type === "payment_out")
      .reduce((sum, t) => sum + (t.debit || 0), 0);

    const totalDebit = transactions.reduce((sum, t) => sum + (t.debit || 0), 0);
    const totalCredit = transactions.reduce((sum, t) => sum + (t.credit || 0), 0);
    const currentBalance = runningBalance;

    const reportNow = new Date();

    await updateUserLastActivity();
    return NextResponse.json(
      {
        transactions: [openingBalanceRecord, ...transactions],
        summary: {
          openingBalance: calculatedOpeningBalance,
          totalOrders,
          totalPurchaseBills,
          totalPaymentsIn,
          totalPaymentsOut,
          totalPayments: totalPaymentsIn,
          totalDebit,
          totalCredit,
          totalTransactions: transactions.length,
          currentBalance,
          grandTotal: totalOrders + totalPurchaseBills,
        },
        reportMeta: {
          title: "Party Statement",
          fromDate,
          toDate,
          reportDate: reportNow.toISOString().split("T")[0],
          reportTime: reportNow.toTimeString().split(" ")[0],
          companyName: userDoc?.company_name || customer?.company_name || "-",
          companyAddress: userDoc?.company_address || customer?.company_address || "-",
          companyLogo: userDoc?.company_logo || null,
          customerId: customerId,
          customerName: customer?.name || "-",
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (err: unknown) {
    console.error("account-statement GET error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
