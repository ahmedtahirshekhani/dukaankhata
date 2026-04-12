
import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth/utils";
import {
  getCollection,
  COLLECTIONS,
  toObjectId,
  isValidObjectId,
} from "@/lib/db/mongodb";

type LedgerEntryDoc = {
  _id: ObjectId;
  user_id: ObjectId;
  customer_id: ObjectId;
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
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  if (typeof (value as { toISOString?: () => string })?.toISOString === "function") {
    return (value as { toISOString: () => string }).toISOString();
  }
  const d = new Date(value as string | number);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function dateOnly(value: Date): string {
  return value.toISOString().split("T")[0];
}

function parseDateRange(fromDate: string, toDate: string) {
  const from = new Date(fromDate);
  const to = new Date(toDate);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error("Invalid date range");
  }

  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);

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
    const ledgerCollection = await getCollection<LedgerEntryDoc>(
      COLLECTIONS.CUSTOMER_LEDGER_ENTRIES
    );
    const balanceStateCollection = await getCollection(
      COLLECTIONS.CUSTOMER_BALANCE_STATE
    );
    const ordersCollection = await getCollection(COLLECTIONS.ORDERS);
    const paymentsCollection = await getCollection(COLLECTIONS.CUSTOMER_TRANSACTIONS);
    const purchaseBillsCollection = await getCollection(COLLECTIONS.PURCHASE_BILLS);

    const [customer, userDoc, rangeEntries, balanceState, lastEntryBefore] = await Promise.all([
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
      ledgerCollection
        .aggregate<LedgerEntryDoc>([
          {
            $match: {
              user_id: userId,
              $or: [
                { party_id: customerObjId },
                { customer_id: customerObjId }
              ],
              effective_at: { $gte: from, $lte: to },
            },
          },
          {
            $sort: { effective_at: 1, created_at: 1, _id: 1 }
          }
        ])
        .toArray(),
      balanceStateCollection.findOne(
        {
          user_id: userId,
          $or: [
            { party_id: customerObjId },
            { customer_id: customerObjId }
          ]
        },
        { projection: { current_balance: 1 } }
      ),
      ledgerCollection.findOne(
        {
          user_id: userId,
          $or: [
            { party_id: customerObjId },
            { customer_id: customerObjId }
          ],
          effective_at: { $lt: from },
        },
        {
          sort: { effective_at: -1, created_at: -1 },
          projection: { running_balance: 1 },
        }
      ),
    ]);

    const openingBalance = Number(
      lastEntryBefore?.running_balance ?? customer?.opening_balance ?? 0
    );

const allEntries = rangeEntries;
    const entries = allEntries.filter(
      (entry) => entry.event_type !== "opening_balance"
    );

    const orderIds = entries
      .filter((entry) => entry.event_source === "order" && entry.event_source_id)
      .map((entry) => entry.event_source_id!.toString())
      .filter(isValidObjectId);

    const paymentIds = entries
      .filter(
        (entry) =>
          (entry.event_source === "party_transaction" || entry.event_source === "customer_transaction") &&
          entry.event_source_id &&
          entry.event_type !== "purchase_bill_debit"
      )
      .map((entry) => entry.event_source_id!.toString())
      .filter(isValidObjectId);

    const purchaseBillIds = entries
      .filter((entry) => entry.event_type === "purchase_bill_debit" && entry.event_source_id)
      .map((entry) => entry.event_source_id!.toString())
      .filter(isValidObjectId);

    const [orderDocs, paymentDocs, purchaseBillDocs] = await Promise.all([
      orderIds.length
        ? ordersCollection
            .find({
              _id: { $in: orderIds.map((id) => toObjectId(id)) },
              user_id: userId,
            })
            .toArray()
        : Promise.resolve([]),
      paymentIds.length
        ? paymentsCollection
            .find({
              _id: { $in: paymentIds.map((id) => toObjectId(id)) },
              user_id: userId,
            })
            .toArray()
        : Promise.resolve([]),
      purchaseBillIds.length
        ? purchaseBillsCollection
            .find({
              _id: { $in: purchaseBillIds.map((id) => toObjectId(id)) },
              user_id: userId,
            })
            .toArray()
        : Promise.resolve([]),
    ]);

    const orderMap = new Map(orderDocs.map((doc: any) => [doc._id.toString(), doc]));
    const paymentMap = new Map(
      paymentDocs.map((doc: any) => [doc._id.toString(), doc])
    );
    const purchaseBillMap = new Map(
      purchaseBillDocs.map((doc: any) => [doc._id.toString(), doc])
    );

    let runningBalance = openingBalance;

    const transactions = entries.map((entry: LedgerEntryDoc) => {
      const amountDelta = Number(entry.amount_delta || 0);
      runningBalance += amountDelta;

      const isOrderDebit = entry.event_type === "order_debit";
      const isPaymentCredit =
        entry.event_type === "payment_in_credit" ||
        entry.event_type === "order_payment_credit";
      const isPaymentOutDebit = entry.event_type === "payment_out_debit";
      const isPurchaseBillDebit = entry.event_type === "purchase_bill_debit";

      const sourceId = entry.event_source_id?.toString?.() || null;
      const sourceOrder = sourceId ? orderMap.get(sourceId) : null;
      const sourcePayment = sourceId ? paymentMap.get(sourceId) : null;
      const sourcePurchaseBill = sourceId ? purchaseBillMap.get(sourceId) : null;

      const items = Array.isArray(sourceOrder?.items) ? sourceOrder.items : [];
      const billItems = Array.isArray(sourcePurchaseBill?.items) ? sourcePurchaseBill.items : [];
      
      const qty =
        isOrderDebit
          ? items.reduce(
              (sum: number, item: any) => sum + Number(item?.quantity || 0),
              0
            )
          : isPurchaseBillDebit
            ? billItems.reduce(
                (sum: number, item: any) => sum + Number(item?.quantity || 0),
                0
              )
            : null;

      const unitPrice =
        isOrderDebit && items.length === 1 ? Number(items[0]?.price || 0) : null;

      let description = "Adjustment";
      if (isOrderDebit) {
        const names = items
          .map((item: any) => item?.name)
          .filter((name: unknown) => typeof name === "string" && name.trim() !== "")
          .slice(0, 3);
        description = names.length > 0 ? names.join(", ") : "Order";
      } else if (isPaymentCredit) {
        description = "Payment In";
      } else if (isPaymentOutDebit) {
        description = "Payment Out";
      } else if (isPurchaseBillDebit) {
        description = "Purchase Bill";
      } else if (entry.event_type === "manual_adjustment") {
        description = "Manual Adjustment";
      }

      const amount = Math.abs(amountDelta);
      const debit = amountDelta > 0 ? amount : 0;
      const credit = amountDelta < 0 ? amount : 0;

      return {
        id: entry._id.toString(),
        type: isOrderDebit
          ? "order"
          : isPaymentCredit
            ? "payment_in"
            : isPaymentOutDebit
              ? "payment_out"
              : isPurchaseBillDebit
                ? "purchase_bill"
                : "adjustment",
        orderValue: isOrderDebit ? Math.abs(amountDelta) : null,
        paidAmount: isPaymentCredit ? Math.abs(amountDelta) : null,
        orderId:
          sourceOrder?.invoice_no ||
          sourceOrder?._id?.toString?.() ||
          (isOrderDebit ? sourceId : null) ||
          (isPurchaseBillDebit && sourcePurchaseBill?.id ? sourcePurchaseBill.id : null),
        description,
        qty,
        unitPrice,
        amount,
        debit,
        credit,
        invoiceNo:
          typeof entry.metadata?.invoice_no === "string"
            ? entry.metadata.invoice_no
            : sourcePurchaseBill?.id
              ? `Bill-${sourcePurchaseBill.id.toString().slice(-8)}`
              : null,
        dateTime: asISO(entry.effective_at || entry.created_at),
        paidDate: isPaymentCredit
          ? asISO(entry.effective_at || entry.created_at)
          : null,
        balance: runningBalance,
      };
    });

    const openingBalanceRecord = {
      id: "opening_balance" as const,
      type: "opening_balance" as const,
      orderValue: null,
      paidAmount: null,
      orderId: null,
      description: "Opening Balance",
      qty: null,
      unitPrice: null,
      amount: Math.abs(openingBalance),
      debit: openingBalance > 0 ? Math.abs(openingBalance) : 0,
      credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
      invoiceNo: null,
      dateTime: from.toISOString(),
      paidDate: null,
      balance: openingBalance,
    };

    const totalOrders = entries
      .filter((entry) => entry.event_type === "order_debit")
      .reduce((sum, entry) => sum + Math.abs(Number(entry.amount_delta || 0)), 0);

    const totalPurchaseBills = entries
      .filter((entry) => entry.event_type === "purchase_bill_debit")
      .reduce((sum, entry) => sum + Math.abs(Number(entry.amount_delta || 0)), 0);

    const totalPaymentsIn = entries
      .filter(
        (entry) =>
          entry.event_type === "payment_in_credit" ||
          entry.event_type === "order_payment_credit"
      )
      .reduce((sum, entry) => sum + Math.abs(Number(entry.amount_delta || 0)), 0);

    const totalPaymentsOut = entries
      .filter((entry) => entry.event_type === "payment_out_debit")
      .reduce((sum, entry) => sum + Math.abs(Number(entry.amount_delta || 0)), 0);

    const totalPayments = totalPaymentsIn - totalPaymentsOut;

    const currentBalance = Number(
      balanceState?.current_balance ??
        customer?.balance ??
        openingBalance
    );

    const reportNow = new Date();

    return NextResponse.json({
      transactions: [openingBalanceRecord, ...transactions],
      summary: {
        openingBalance,
        totalOrders,
        totalPurchaseBills,
        totalPaymentsIn,
        totalPaymentsOut,
        totalPayments,
        currentBalance,
        grandTotal: totalOrders + totalPurchaseBills,
      },
      reportMeta: {
        title: "Account Ledger",
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
    });
  } catch (err: unknown) {
    console.error("account-statement GET error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";