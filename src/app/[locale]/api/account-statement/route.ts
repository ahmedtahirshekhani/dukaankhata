// app/[locale]/api/account-statement-latest/route.ts

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

function parseDateRange(fromDate: string, toDate: string) {
  const [fY, fM, fD] = fromDate.split("-").map(Number);
  const [tY, tM, tD] = toDate.split("-").map(Number);

  if (!fY || !fM || !fD || !tY || !tM || !tD) {
    throw new Error("Invalid date range");
  }

  const from = new Date(fY, fM - 1, fD, 0, 0, 0, 0);
  const to = new Date(tY, tM - 1, tD, 23, 59, 59, 999);

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
    const ledgerCollection = await getCollection<LedgerEntryDoc>(
      COLLECTIONS.CUSTOMER_LEDGER_ENTRIES
    );
    const balanceStateCollection = await getCollection(
      COLLECTIONS.CUSTOMER_BALANCE_STATE
    );
    const ordersCollection = await getCollection(COLLECTIONS.ORDERS);
    const paymentsCollection = await getCollection(COLLECTIONS.CUSTOMER_TRANSACTIONS);
    const purchaseBillsCollection = await getCollection(COLLECTIONS.PURCHASE_BILLS);
    const paymentMethodsCollection = await getCollection(COLLECTIONS.PAYMENT_METHODS);

    // Auto-sync any mismatched order_payment_credit dates with their parent order's effective_at / sale_date
    try {
      const mismatchedOrderPayments = await ledgerCollection.aggregate([
        {
          $match: {
            user_id: userId,
            $or: [{ party_id: customerObjId }, { customer_id: customerObjId }],
            event_type: "order_payment_credit"
          }
        },
        {
          $lookup: {
            from: COLLECTIONS.PARTY_LEDGER_ENTRIES,
            let: { orderId: "$event_source_id", uId: "$user_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$user_id", "$$uId"] },
                      { $eq: ["$event_source_id", "$$orderId"] },
                      { $eq: ["$event_type", "order_debit"] }
                    ]
                  }
                }
              }
            ],
            as: "orderDebitEntry"
          }
        },
        { $unwind: "$orderDebitEntry" },
        {
          $match: {
            $expr: { $ne: ["$effective_at", "$orderDebitEntry.effective_at"] }
          }
        }
      ]).toArray();

      if (mismatchedOrderPayments.length > 0) {
        const bulkOps = mismatchedOrderPayments.map((pm: any) => ({
          updateOne: {
            filter: { _id: pm._id },
            update: { $set: { effective_at: pm.orderDebitEntry.effective_at } }
          }
        }));
        await ledgerCollection.bulkWrite(bulkOps);
      }
    } catch (syncErr) {
      console.error("Error auto-syncing ledger payment dates:", syncErr);
    }

    // Parallel queries
    const [customer, userDoc, rangeEntries, priorAgg, paymentMethodsDocs] = await Promise.all([
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
      ledgerCollection
        .aggregate<{ _id: null; totalDelta: number; hasOpeningEntry: number }>([
          {
            $match: {
              user_id: userId,
              $or: [
                { party_id: customerObjId },
                { customer_id: customerObjId }
              ],
              effective_at: { $lt: from },
            },
          },
          {
            $group: {
              _id: null,
              totalDelta: { $sum: "$amount_delta" },
              hasOpeningEntry: {
                $sum: {
                  $cond: [{ $eq: ["$event_type", "opening_balance"] }, 1, 0]
                }
              }
            }
          }
        ])
        .toArray(),
      paymentMethodsCollection.find({ user_id: userId }).toArray()
    ]);

    // Calculate opening balance before 'from' date
    let openingBalance = 0;
    if (priorAgg.length > 0) {
      if (priorAgg[0].hasOpeningEntry > 0) {
        openingBalance = Number(priorAgg[0].totalDelta || 0);
      } else {
        openingBalance = Number(customer?.opening_balance ?? 0) + Number(priorAgg[0].totalDelta || 0);
      }
    } else {
      openingBalance = Number(customer?.opening_balance ?? 0);
    }

    const paymentMethodMap = new Map<string, string>([
      ['cash', 'Cash'],
      ['cheque', 'Cheque'],
      ...(paymentMethodsDocs.map((pm: any) => [pm._id.toString(), pm.bank_name || ''] as [string, string]))
    ]);

    const rawEntries = rangeEntries.filter(
      (entry) => entry.event_type !== "opening_balance"
    );

    // Collect all candidate source IDs
    const orderIds = new Set<string>();
    const paymentIds = new Set<string>();
    const purchaseBillIds = new Set<string>();
    const saleReturnIds = new Set<string>();

    for (const entry of rawEntries) {
      const sourceIdStr = entry.event_source_id ? entry.event_source_id.toString() : null;
      if (!sourceIdStr) continue;

      const eventType = entry.event_type || "";
      const eventKey = entry.event_key || "";
      const eventSource = entry.event_source || "";

      if (
        eventSource === "order" ||
        eventType.startsWith("order_") ||
        eventKey.startsWith("order_")
      ) {
        orderIds.add(sourceIdStr);
      } else if (
        eventSource === "sale_return" ||
        eventType.startsWith("sale_return") ||
        eventKey.startsWith("sale_return")
      ) {
        saleReturnIds.add(sourceIdStr);
      } else if (
        eventSource === "purchase_bill" ||
        eventType.startsWith("purchase_bill") ||
        eventKey.startsWith("purchase_bill")
      ) {
        purchaseBillIds.add(sourceIdStr);
      } else if (
        eventType.startsWith("payment_") ||
        eventKey.startsWith("payment_") ||
        eventSource === "party_transaction" ||
        eventSource === "customer_transaction"
      ) {
        paymentIds.add(sourceIdStr);
      }
    }

    const [orderDocs, paymentDocs, purchaseBillDocs, saleReturnDocs] = await Promise.all([
      orderIds.size
        ? ordersCollection
            .find({
              _id: { $in: Array.from(orderIds).filter(isValidObjectId).map((id) => toObjectId(id)) },
              user_id: userId,
            })
            .toArray()
        : Promise.resolve([]),
      paymentIds.size
        ? paymentsCollection
            .find({
              _id: { $in: Array.from(paymentIds).filter(isValidObjectId).map((id) => toObjectId(id)) },
              user_id: userId,
            })
            .toArray()
        : Promise.resolve([]),
      purchaseBillIds.size
        ? purchaseBillsCollection
            .find({
              _id: { $in: Array.from(purchaseBillIds).filter(isValidObjectId).map((id) => toObjectId(id)) },
              user_id: userId,
            })
            .toArray()
        : Promise.resolve([]),
      saleReturnIds.size
        ? getCollection(COLLECTIONS.SALE_RETURN_TRANSACTIONS).then((c) =>
            c
              .find({
                _id: { $in: Array.from(saleReturnIds).filter(isValidObjectId).map((id) => toObjectId(id)) },
                user_id: userId,
              })
              .toArray()
          )
        : Promise.resolve([]),
    ]);

    const orderMap = new Map(orderDocs.map((doc: any) => [doc._id.toString(), doc]));
    const paymentMap = new Map(
      paymentDocs.map((doc: any) => [doc._id.toString(), doc])
    );
    const purchaseBillMap = new Map(
      purchaseBillDocs.map((doc: any) => [doc._id.toString(), doc])
    );
    const saleReturnMap = new Map(
      saleReturnDocs.map((doc: any) => [doc._id.toString(), doc])
    );

    // Build unique statement transactions:
    // - Deleted items -> 0 rows emitted
    // - Edited items -> exactly 1 row with current document values (no reversal adjustment rows)
    const handledSourceIds = new Set<string>();
    const builtTransactions: any[] = [];

    for (const entry of rawEntries) {
      const sourceIdStr = entry.event_source_id ? entry.event_source_id.toString() : null;
      const eventType = entry.event_type || "";
      const eventKey = entry.event_key || "";
      const eventSource = entry.event_source || "";
      const metadata = (entry.metadata as any) || {};

      // 1. Order / Invoice
      if (
        eventSource === "order" ||
        eventType.startsWith("order_") ||
        eventKey.startsWith("order_")
      ) {
        if (!sourceIdStr) continue;
        if (handledSourceIds.has(sourceIdStr)) continue;
        handledSourceIds.add(sourceIdStr);

        const sourceOrder = orderMap.get(sourceIdStr);
        if (!sourceOrder || sourceOrder.status === "cancelled" || sourceOrder.is_delete) {
          // Order was deleted or cancelled -> Do not show in statement
          continue;
        }

        const totalAmount = Number(sourceOrder.total_amount ?? 0);
        const paidAmount = Number(sourceOrder.payment?.paid_amount ?? 0);
        const balanceDue = Math.max(0, totalAmount - paidAmount);
        const items = Array.isArray(sourceOrder.items) ? sourceOrder.items : [];
        const expandedItems = items.map((item: any) => {
          const qty = parseFloat(item.quantity) || 0;
          const prc = parseFloat(item.price ?? item.sell_price) || 0;
          return {
            name: item.name || "Item",
            quantity: qty,
            price: prc,
            amount: qty * prc,
          };
        });

        builtTransactions.push({
          id: entry._id.toString(),
          type: "order",
          description: "SALES",
          items: expandedItems,
          amount: totalAmount,
          debit: balanceDue,
          credit: 0,
          orderId: sourceOrder.invoice_no || sourceIdStr,
          dateTime: asISO(sourceOrder.sale_date || sourceOrder.created_at || entry.effective_at),
        });
      }

      // 2. Sale Return
      else if (
        eventSource === "sale_return" ||
        eventType.startsWith("sale_return") ||
        eventKey.startsWith("sale_return")
      ) {
        if (!sourceIdStr) continue;
        if (handledSourceIds.has(sourceIdStr)) continue;
        handledSourceIds.add(sourceIdStr);

        const sourceSaleReturn = saleReturnMap.get(sourceIdStr);
        if (!sourceSaleReturn || sourceSaleReturn.is_delete) {
          // Sale return was deleted -> Do not show in statement
          continue;
        }

        const totalAmount = Number(sourceSaleReturn.total_amount ?? sourceSaleReturn.payment_amount ?? 0);
        const refundAmount = Number(
          sourceSaleReturn.paid_amount ?? sourceSaleReturn.refund_amount ?? 0
        );
        const balanceDue = Math.max(0, totalAmount - refundAmount);
        const returnNo = sourceSaleReturn.return_number || sourceIdStr;
        const saleReturnItems = Array.isArray(sourceSaleReturn.items)
          ? sourceSaleReturn.items
          : [];
        const expandedItems = saleReturnItems.map((item: any) => {
          const qty = parseFloat(item.quantity) || 0;
          const prc = parseFloat(item.rate ?? item.price ?? item.cost_price ?? 0);
          const amt = parseFloat(item.amount ?? qty * prc);
          return {
            name: item.itemName || item.name || item.product_name || "Item",
            quantity: qty,
            price: prc,
            amount: amt,
          };
        });

        builtTransactions.push({
          id: entry._id.toString(),
          type: "sale_return",
          description: "SALE RETURN (Credit Note)",
          items: expandedItems,
          amount: totalAmount,
          debit: 0,
          credit: balanceDue,
          orderId: returnNo,
          dateTime: asISO(
            sourceSaleReturn.date || sourceSaleReturn.created_at || entry.effective_at
          ),
        });
      }

      // 3. Purchase Bill
      else if (
        eventSource === "purchase_bill" ||
        eventType.startsWith("purchase_bill") ||
        eventKey.startsWith("purchase_bill")
      ) {
        if (!sourceIdStr) continue;
        if (handledSourceIds.has(sourceIdStr)) continue;
        handledSourceIds.add(sourceIdStr);

        const sourcePurchaseBill = purchaseBillMap.get(sourceIdStr);
        if (!sourcePurchaseBill || sourcePurchaseBill.is_delete) {
          // Purchase bill was deleted -> Do not show in statement
          continue;
        }

        const totalAmount = Number(sourcePurchaseBill.total_amount ?? 0);
        const paidAmount = Number(sourcePurchaseBill.paid_amount ?? 0);
        const balanceDue = Math.max(0, totalAmount - paidAmount);
        const billNo =
          sourcePurchaseBill.purchase_number ||
          sourcePurchaseBill.purchase_no ||
          sourcePurchaseBill.bill_number ||
          sourceIdStr;
        const billItems = Array.isArray(sourcePurchaseBill.items) ? sourcePurchaseBill.items : [];
        const expandedItems = billItems.map((item: any) => {
          const qty = parseFloat(item.quantity) || 0;
          const cost = parseFloat(item.cost_price || item.price) || 0;
          const amt = parseFloat(item.amount) || qty * cost;
          return {
            name: item.product_name || item.name || "Item",
            quantity: qty,
            price: cost,
            amount: amt,
          };
        });

        builtTransactions.push({
          id: entry._id.toString(),
          type: "purchase_bill",
          description: "PURCHASE BILL",
          items: expandedItems,
          amount: totalAmount,
          debit: 0,
          credit: balanceDue,
          orderId: billNo,
          dateTime: asISO(
            sourcePurchaseBill.bill_date ||
            sourcePurchaseBill.date ||
            sourcePurchaseBill.created_at ||
            entry.effective_at
          ),
        });
      }

      // 4. Payment In / Payment Out
      else if (
        eventType.startsWith("payment_") ||
        eventKey.startsWith("payment_") ||
        eventSource === "party_transaction" ||
        eventSource === "customer_transaction"
      ) {
        if (!sourceIdStr) {
          // If no source ID and it's a reversal/adjustment, skip it
          if (eventKey.includes("_reversal") || eventKey.includes("_reverse") || eventKey.includes("_delete")) {
            continue;
          }
        } else {
          if (handledSourceIds.has(sourceIdStr)) continue;
          handledSourceIds.add(sourceIdStr);

          const sourcePayment = paymentMap.get(sourceIdStr);
          if (!sourcePayment || sourcePayment.is_delete) {
            // Payment was deleted -> Do not show in statement
            continue;
          }

          const paymentAmount = Number(sourcePayment.payment_amount ?? 0);
          const isPaymentIn =
            sourcePayment.type === "payment-in" ||
            (eventType === "payment_in_credit" && sourcePayment.type !== "payment-out");
          const methodId = sourcePayment.payment_method_id?.toString() || "";
          const methodName = paymentMethodMap.get(methodId) || "Cash";
          const paymentNo = sourcePayment.payment_number || sourcePayment.paymentNumber || null;

          const description = isPaymentIn
            ? (methodName ? `Payment Received (${methodName})` : "Payment Received")
            : (methodName ? `Payment Out (${methodName})` : "Payment Out");

          builtTransactions.push({
            id: entry._id.toString(),
            type: isPaymentIn ? "payment_in" : "payment_out",
            description,
            items: [],
            amount: paymentAmount,
            debit: isPaymentIn ? 0 : paymentAmount,
            credit: isPaymentIn ? paymentAmount : 0,
            orderId: paymentNo || sourcePayment._id?.toString() || sourceIdStr,
            dateTime: asISO(sourcePayment.date || sourcePayment.created_at || entry.effective_at),
          });
        }
      }

      // 5. Standalone Manual Adjustment
      else if (eventType === "manual_adjustment") {
        const reason = (metadata.reason || "").toString().toLowerCase();
        const k = eventKey.toLowerCase();
        // Skip any reversal or update adjustment
        if (
          k.includes("reversal") ||
          k.includes("reverse") ||
          k.includes("delete") ||
          k.includes("update") ||
          reason.includes("reversal") ||
          reason.includes("reverse") ||
          reason.includes("deleted")
        ) {
          continue;
        }

        const amountDelta = Number(entry.amount_delta || 0);
        const debit = amountDelta > 0 ? Math.abs(amountDelta) : 0;
        const credit = amountDelta < 0 ? Math.abs(amountDelta) : 0;

        builtTransactions.push({
          id: entry._id.toString(),
          type: "adjustment",
          description: "Manual Adjustment",
          items: [],
          amount: Math.abs(amountDelta),
          debit,
          credit,
          orderId: null,
          dateTime: asISO(entry.effective_at || entry.created_at),
        });
      }
    }

    // Sort transactions chronologically
    builtTransactions.sort((a, b) => {
      const tA = new Date(a.dateTime).getTime() || 0;
      const tB = new Date(b.dateTime).getTime() || 0;
      return tA - tB;
    });

    // Compute running balance
    let runningBalance = openingBalance;
    const transactions = builtTransactions
      .filter((t) => t.debit > 0 || t.credit > 0 || Math.abs(t.debit - t.credit) >= 0.01)
      .map((t) => {
        runningBalance += (t.debit - t.credit);
        return {
          ...t,
          balance: runningBalance,
        };
      });

    // Virtual Opening Balance record
    const openingDate = from.getFullYear() === 1970 && customer?.created_at
      ? new Date(customer.created_at).toISOString()
      : from.toISOString();

    const openingBalanceRecord = {
      id: "opening_balance",
      type: "opening_balance",
      description: "Opening Balance",
      items: [],
      amount: Math.abs(openingBalance),
      debit: openingBalance > 0 ? Math.abs(openingBalance) : 0,
      credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
      orderId: null,
      dateTime: openingDate,
      balance: openingBalance,
    };

    const totalOrders = transactions
      .filter((t) => t.type === "order")
      .reduce((sum, t) => sum + (t.amount || t.debit || 0), 0);

    const totalPurchaseBills = transactions
      .filter((t) => t.type === "purchase_bill")
      .reduce((sum, t) => sum + (t.amount || t.credit || 0), 0);

    const totalPaymentsIn = transactions
      .reduce((sum, t) => sum + (t.credit || 0), 0);

    const totalPaymentsOut = transactions
      .reduce((sum, t) => sum + (t.debit || 0), 0);

    const currentBalance = runningBalance;

    const reportNow = new Date();

    await updateUserLastActivity();
    return NextResponse.json({
      transactions: [openingBalanceRecord, ...transactions],
      summary: {
        openingBalance,
        totalOrders,
        totalPurchaseBills,
        totalPaymentsIn,
        totalPaymentsOut,
        totalPayments: totalPaymentsIn,
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
    });
  } catch (err: unknown) {
    console.error("account-statement-latest GET error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
