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

    // Two-pass folding to ensure order-independence
    // Step 1: Pre-index entries by event_source_id
    const orderDebits = new Map<string, LedgerEntryDoc>();
    const orderPaymentCredits = new Map<string, LedgerEntryDoc[]>();
    const orderAdjustmentsMap = new Map<string, LedgerEntryDoc[]>();

    const pbDebits = new Map<string, LedgerEntryDoc>();
    const pbCredits = new Map<string, LedgerEntryDoc[]>();
    const pbAdjustmentsMap = new Map<string, LedgerEntryDoc[]>();

    const srCredits = new Map<string, LedgerEntryDoc>();
    const srDebits = new Map<string, LedgerEntryDoc[]>();
    const srAdjustmentsMap = new Map<string, LedgerEntryDoc[]>();

    for (const entry of rawEntries) {
      const sourceIdStr = entry.event_source_id?.toString();
      const eventKeyStr = entry.event_key || "";

      if (entry.event_type === "order_debit" && sourceIdStr) {
        orderDebits.set(sourceIdStr, entry);
      } else if (entry.event_type === "order_payment_credit" && sourceIdStr) {
        if (!orderPaymentCredits.has(sourceIdStr)) orderPaymentCredits.set(sourceIdStr, []);
        orderPaymentCredits.get(sourceIdStr)!.push(entry);
      } else if (
        entry.event_type === "manual_adjustment" &&
        (eventKeyStr.startsWith("order_update_") || eventKeyStr.startsWith("order_delete_") || eventKeyStr.startsWith("order_")) &&
        sourceIdStr
      ) {
        if (!orderAdjustmentsMap.has(sourceIdStr)) orderAdjustmentsMap.set(sourceIdStr, []);
        orderAdjustmentsMap.get(sourceIdStr)!.push(entry);
      } else if (entry.event_type === "purchase_bill_debit" && sourceIdStr) {
        pbDebits.set(sourceIdStr, entry);
      } else if (entry.event_type === "purchase_bill_credit" && sourceIdStr) {
        if (!pbCredits.has(sourceIdStr)) pbCredits.set(sourceIdStr, []);
        pbCredits.get(sourceIdStr)!.push(entry);
      } else if (
        entry.event_type === "manual_adjustment" &&
        (eventKeyStr.startsWith("purchase_bill_") || eventKeyStr.startsWith("purchase_bill_payment_")) &&
        sourceIdStr
      ) {
        if (!pbAdjustmentsMap.has(sourceIdStr)) pbAdjustmentsMap.set(sourceIdStr, []);
        pbAdjustmentsMap.get(sourceIdStr)!.push(entry);
      } else if (entry.event_type === "sale_return_credit" && !eventKeyStr.startsWith("sale_return_update") && sourceIdStr) {
        srCredits.set(sourceIdStr, entry);
      } else if (entry.event_type === "sale_return_debit" && !eventKeyStr.startsWith("sale_return_update") && sourceIdStr) {
        if (!srDebits.has(sourceIdStr)) srDebits.set(sourceIdStr, []);
        srDebits.get(sourceIdStr)!.push(entry);
      } else if (
        (entry.event_type === "sale_return_credit" || entry.event_type === "sale_return_debit") &&
        eventKeyStr.startsWith("sale_return_update") &&
        sourceIdStr
      ) {
        if (!srAdjustmentsMap.has(sourceIdStr)) srAdjustmentsMap.set(sourceIdStr, []);
        srAdjustmentsMap.get(sourceIdStr)!.push(entry);
      }
    }

    // Step 2: Build processedEntries
    const processedEntries: LedgerEntryDoc[] = [];
    const foldedEntryIds = new Set<string>();

    for (const entry of rawEntries) {
      const entryIdStr = entry._id.toString();
      if (foldedEntryIds.has(entryIdStr)) continue;

      const sourceIdStr = entry.event_source_id?.toString();
      const eventKeyStr = entry.event_key || "";

      // Order Debit
      if (entry.event_type === "order_debit" && sourceIdStr) {
        let totalAmt = Number((entry.metadata as any)?.total_amount ?? entry.amount_delta);
        let paidAmt = 0;
        let paymentMethodId = (entry.metadata as any)?.payment_method_id;
        let isDeleted = false;

        // Fold order_payment_credits
        const pmCredits = orderPaymentCredits.get(sourceIdStr) || [];
        for (const pm of pmCredits) {
          paidAmt += Math.abs(Number(pm.amount_delta));
          paymentMethodId = (pm.metadata as any)?.payment_method_id || paymentMethodId;
          foldedEntryIds.add(pm._id.toString());
        }

        // Fold order adjustments
        const adjs = orderAdjustmentsMap.get(sourceIdStr) || [];
        for (const adj of adjs) {
          const adjKey = adj.event_key || "";
          if (adjKey.startsWith("order_delete_reverse") || (adj.metadata as any)?.reason === "order_deleted") {
            isDeleted = true;
          } else if ((adj.metadata as any)?.newTotal !== undefined) {
            totalAmt = Number((adj.metadata as any).newTotal);
            paidAmt = Number((adj.metadata as any).newPaid || 0);
          }
          foldedEntryIds.add(adj._id.toString());
        }

        const newEntry: LedgerEntryDoc = {
          ...entry,
          amount_delta: totalAmt - paidAmt,
          metadata: {
            ...entry.metadata,
            total_amount: totalAmt,
            paid_amount: paidAmt,
            payment_method_id: paymentMethodId,
            is_deleted: isDeleted,
          }
        };
        processedEntries.push(newEntry);
      }
      // Unfolded order payment credit (original order outside date range)
      else if (entry.event_type === "order_payment_credit" && sourceIdStr) {
        if (!orderDebits.has(sourceIdStr)) {
          processedEntries.push(entry);
        }
      }
      // Unfolded order adjustment (original order outside date range)
      else if (
        entry.event_type === "manual_adjustment" &&
        (eventKeyStr.startsWith("order_update_") || eventKeyStr.startsWith("order_delete_") || eventKeyStr.startsWith("order_")) &&
        sourceIdStr
      ) {
        if (!orderDebits.has(sourceIdStr)) {
          processedEntries.push({ ...entry, event_key: "order_update_net", event_type: "manual_adjustment" });
        }
      }
      // Purchase Bill Debit
      else if (entry.event_type === "purchase_bill_debit" && sourceIdStr) {
        let totalAmt = Number((entry.metadata as any)?.total_amount ?? Math.abs(entry.amount_delta));
        let paidAmt = 0;
        let paymentMethodId = (entry.metadata as any)?.payment_method_id;
        let isDeleted = false;

        const pmCredits = pbCredits.get(sourceIdStr) || [];
        for (const pm of pmCredits) {
          paidAmt += Math.abs(Number((pm.metadata as any)?.paid_amount ?? pm.amount_delta));
          paymentMethodId = (pm.metadata as any)?.payment_method_id || paymentMethodId;
          foldedEntryIds.add(pm._id.toString());
        }

        const adjs = pbAdjustmentsMap.get(sourceIdStr) || [];
        for (const adj of adjs) {
          const adjKey = adj.event_key || "";
          if (adjKey.startsWith("purchase_bill_delete_") || (adj.metadata as any)?.note?.includes("deletion")) {
            isDeleted = true;
          }
          foldedEntryIds.add(adj._id.toString());
        }

        const newEntry: LedgerEntryDoc = {
          ...entry,
          amount_delta: -(totalAmt - paidAmt),
          metadata: {
            ...entry.metadata,
            total_amount: totalAmt,
            paid_amount: paidAmt,
            payment_method_id: paymentMethodId,
            is_deleted: isDeleted,
          }
        };
        processedEntries.push(newEntry);
      }
      // Unfolded purchase bill payment credit
      else if (entry.event_type === "purchase_bill_credit" && sourceIdStr) {
        if (!pbDebits.has(sourceIdStr)) {
          const paidAmt = Math.abs(Number((entry.metadata as any)?.paid_amount ?? entry.amount_delta));
          processedEntries.push({ ...entry, amount_delta: paidAmt });
        }
      }
      // Unfolded purchase bill adjustment
      else if (
        entry.event_type === "manual_adjustment" &&
        (eventKeyStr.startsWith("purchase_bill_") || eventKeyStr.startsWith("purchase_bill_payment_")) &&
        sourceIdStr
      ) {
        if (!pbDebits.has(sourceIdStr)) {
          processedEntries.push({ ...entry, event_key: "purchase_bill_debit_net", event_type: "manual_adjustment" });
        }
      }
      // Sale Return Credit
      else if (entry.event_type === "sale_return_credit" && !eventKeyStr.startsWith("sale_return_update") && sourceIdStr) {
        let totalAmt = Math.abs(Number((entry.metadata as any)?.total_amount ?? entry.amount_delta));
        let refundAmt = 0;
        let paymentMethodId = (entry.metadata as any)?.payment_method_id;
        let isDeleted = Boolean((entry.metadata as any)?.is_deleted);

        const refunds = srDebits.get(sourceIdStr) || [];
        for (const rf of refunds) {
          refundAmt += Math.abs(Number((rf.metadata as any)?.paid_amount ?? rf.amount_delta));
          paymentMethodId = (rf.metadata as any)?.payment_method_id || paymentMethodId;
          foldedEntryIds.add(rf._id.toString());
        }

        const adjs = srAdjustmentsMap.get(sourceIdStr) || [];
        for (const adj of adjs) {
          foldedEntryIds.add(adj._id.toString());
        }

        const newEntry: LedgerEntryDoc = {
          ...entry,
          amount_delta: -(totalAmt - refundAmt),
          metadata: {
            ...entry.metadata,
            total_amount: totalAmt,
            paid_amount: refundAmt,
            refund_amount: refundAmt,
            payment_method_id: paymentMethodId,
            is_deleted: isDeleted,
          }
        };
        processedEntries.push(newEntry);
      }
      // Unfolded sale return debit (refund)
      else if (entry.event_type === "sale_return_debit" && !eventKeyStr.startsWith("sale_return_update") && sourceIdStr) {
        if (!srCredits.has(sourceIdStr)) {
          processedEntries.push(entry);
        }
      }
      // Unfolded sale return adjustment
      else if (
        (entry.event_type === "sale_return_credit" || entry.event_type === "sale_return_debit") &&
        eventKeyStr.startsWith("sale_return_update") &&
        sourceIdStr
      ) {
        if (!srCredits.has(sourceIdStr) && !srDebits.has(sourceIdStr)) {
          processedEntries.push(entry);
        }
      }
      // All other entries (Payment-In, Payment-Out, etc.)
      else {
        processedEntries.push(entry);
      }
    }

    const entries = processedEntries.filter(
      (e) =>
        e.event_type === "order_debit" ||
        e.event_type === "purchase_bill_debit" ||
        e.event_type === "sale_return_credit" ||
        (!(e.metadata as any)?.is_deleted && Math.abs(Number(e.amount_delta)) >= 0.01)
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

    const saleReturnIds = entries
      .filter(
        (entry) =>
          (entry.event_type === "sale_return_credit" || entry.event_type === "sale_return_debit") &&
          entry.event_source_id
      )
      .map((entry) => entry.event_source_id!.toString())
      .filter(isValidObjectId);

    const [orderDocs, paymentDocs, purchaseBillDocs, saleReturnDocs] = await Promise.all([
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
      saleReturnIds.length
        ? getCollection(COLLECTIONS.SALE_RETURN_TRANSACTIONS).then((c) =>
            c
              .find({
                _id: { $in: saleReturnIds.map((id) => toObjectId(id)) },
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

    let runningBalance = openingBalance;

    const transactions = entries.map((entry: LedgerEntryDoc) => {
      const amountDelta = Number(entry.amount_delta || 0);

      const isOrderDebit = entry.event_type === "order_debit";
      const isPaymentCredit =
        entry.event_type === "payment_in_credit" ||
        entry.event_type === "order_payment_credit";
      const isPaymentOutDebit = entry.event_type === "payment_out_debit";
      const isPurchaseBillDebit = entry.event_type === "purchase_bill_debit";
      const isPurchaseBillCredit = entry.event_type === "purchase_bill_credit";
      const isSaleReturnCredit = entry.event_type === "sale_return_credit";
      const isSaleReturnDebit = entry.event_type === "sale_return_debit";

      const sourceId = entry.event_source_id?.toString?.() || null;
      const sourceOrder = sourceId ? orderMap.get(sourceId) : null;
      const sourcePayment = sourceId ? paymentMap.get(sourceId) : null;
      const sourcePurchaseBill = sourceId ? purchaseBillMap.get(sourceId) : null;
      const sourceSaleReturn = sourceId ? saleReturnMap.get(sourceId) : null;

      const items = Array.isArray(sourceOrder?.items) ? sourceOrder.items : [];
      const billItems = Array.isArray(sourcePurchaseBill?.items) ? sourcePurchaseBill.items : [];
      const saleReturnItems = Array.isArray(sourceSaleReturn?.items) ? sourceSaleReturn.items : [];
      
      let description = "Adjustment";
      let expandedItems = [];

      const paymentNo = 
        sourcePayment?.payment_number || 
        sourcePayment?.paymentNumber || 
        (entry.metadata as any)?.payment_number || 
        (entry.metadata as any)?.paymentNumber || 
        null;

      if (isOrderDebit) {
        description = "SALES";
        expandedItems = items.map((item: any) => {
          const qty = parseFloat(item.quantity) || 0;
          const prc = parseFloat(item.price) || 0;
          return {
            name: item.name || "Item",
            quantity: qty,
            price: prc,
            amount: qty * prc
          };
        });
      } else if (isPaymentCredit) {
        const methodId = sourcePayment?.payment_method_id?.toString() || (entry.metadata as any)?.payment_method_id?.toString() || "";
        const methodName = paymentMethodMap.get(methodId) || "Cash";
        description = paymentNo 
          ? `Payment Received - Ref # ${paymentNo} (${methodName})`
          : `Payment Received - Ref # ${methodName}-${Math.abs(amountDelta)}`;
      } else if (isPaymentOutDebit) {
        const methodId = sourcePayment?.payment_method_id?.toString() || (entry.metadata as any)?.payment_method_id?.toString() || "";
        const methodName = paymentMethodMap.get(methodId) || "Cash";
        description = paymentNo 
          ? `Payment Out - Ref # ${paymentNo} (${methodName})`
          : `Payment Out - Ref # ${methodName}-${Math.abs(amountDelta)}`;
      } else if (isPurchaseBillDebit) {
        description = "PURCHASE BILL";
        expandedItems = billItems.map((item: any) => {
          const qty = parseFloat(item.quantity) || 0;
          const cost = parseFloat(item.cost_price || item.price) || 0;
          const amt = parseFloat(item.amount) || (qty * cost);
          return {
            name: item.product_name || item.name || "Item",
            quantity: qty,
            price: cost,
            amount: amt
          };
        });
      } else if (isPurchaseBillCredit) {
        description = "Purchase Bill Payment";
      } else if (entry.event_type === "sale_return_credit") {
        if (entry.event_key === "sale_return_credit_net") {
          description = "SALE RETURN (Updated)";
        } else {
          description = "SALE RETURN (Credit Note)";
        }
        expandedItems = saleReturnItems.map((item: any) => {
          const qty = parseFloat(item.quantity) || 0;
          const prc = parseFloat(item.rate ?? item.price ?? item.cost_price ?? 0);
          const amt = parseFloat(item.amount ?? (qty * prc));
          return {
            name: item.itemName || item.name || item.product_name || "Item",
            quantity: qty,
            price: prc,
            amount: amt
          };
        });
      } else if (entry.event_type === "sale_return_debit") {
        if (entry.event_key === "sale_return_debit_net") {
          description = "Refund against Sale Return (Updated)";
        } else {
          const methodId = sourceSaleReturn?.payment_method_id?.toString() || "";
          const methodName = paymentMethodMap.get(methodId) || "Cash";
          description = `Refund against Sale Return - ${methodName}`;
        }
      } else if (entry.event_type === "manual_adjustment") {
        if (entry.event_key === "order_update_net") {
          description = "Invoice (Updated)";
        } else if (entry.event_key === "payment_in_net") {
          description = paymentNo ? `Payment Received - Ref # ${paymentNo} (Updated)` : "Payment Received (Updated)";
        } else if (entry.event_key === "payment_out_net") {
          description = paymentNo ? `Payment Out - Ref # ${paymentNo} (Updated)` : "Payment Out (Updated)";
        } else if (entry.event_key === "purchase_bill_debit_net") {
          description = "PURCHASE BILL (Updated)";
        } else if (entry.event_key === "purchase_bill_credit_net") {
          description = "Purchase Bill Payment (Updated)";
        } else {
          description = "Manual Adjustment";
        }
      } else if (entry.event_type === "opening_balance") {
        description = "Initial Opening Balance";
      }

      let debit = 0;
      let credit = 0;
      let amount = Math.abs(amountDelta);

      if (isOrderDebit) {
        if ((entry.metadata as any)?.is_deleted || (!sourceOrder && !(entry.metadata as any)?.total_amount)) {
          debit = 0;
          credit = 0;
          amount = 0;
        } else {
          const totalAmount = Number((entry.metadata as any)?.total_amount ?? sourceOrder?.total_amount ?? Math.abs(amountDelta));
          const paidAmount = Number((entry.metadata as any)?.paid_amount ?? 0);
          debit = totalAmount;
          credit = paidAmount;
          amount = totalAmount;
        }
      } else if (isPurchaseBillDebit) {
        if ((entry.metadata as any)?.is_deleted || (!sourcePurchaseBill && !(entry.metadata as any)?.total_amount)) {
          debit = 0;
          credit = 0;
          amount = 0;
        } else {
          const totalAmount = Number((entry.metadata as any)?.total_amount ?? sourcePurchaseBill?.total_amount ?? Math.abs(amountDelta));
          const paidAmount = Number((entry.metadata as any)?.paid_amount ?? 0);
          debit = paidAmount;
          credit = totalAmount;
          amount = totalAmount;
        }
      } else if (isSaleReturnCredit) {
        if ((entry.metadata as any)?.is_deleted) {
          debit = 0;
          credit = 0;
          amount = 0;
        } else {
          const totalAmount = Number((entry.metadata as any)?.total_amount ?? sourceSaleReturn?.total_amount ?? Math.abs(amountDelta));
          const refundAmount = Number((entry.metadata as any)?.refund_amount ?? (entry.metadata as any)?.paid_amount ?? 0);
          debit = refundAmount;
          credit = totalAmount;
          amount = totalAmount;
        }
      } else if (isPaymentOutDebit || isSaleReturnDebit || isPurchaseBillCredit) {
        debit = amount;
        credit = 0;
      } else if (isPaymentCredit) {
        credit = amount;
        debit = 0;
      } else {
        debit = amountDelta > 0 ? amount : 0;
        credit = amountDelta < 0 ? amount : 0;
      }

      runningBalance += (debit - credit);

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
                : isPurchaseBillCredit
                  ? "purchase_bill_payment"
                  : (isSaleReturnCredit || isSaleReturnDebit)
                    ? "sale_return"
                    : "adjustment",
        description,
        items: expandedItems,
        amount,
        debit,
        credit,
        orderId:
          sourceOrder?.invoice_no ||
          paymentNo ||
          sourceSaleReturn?.return_number ||
          (isPurchaseBillDebit ? (sourcePurchaseBill?.purchase_number || sourcePurchaseBill?.purchase_no || sourcePurchaseBill?.bill_number || (entry.metadata as any)?.purchase_number || sourcePurchaseBill?.id || sourceId) : null) ||
          sourceOrder?._id?.toString?.() ||
          (isOrderDebit ? sourceId : null) ||
          (isSaleReturnCredit || isSaleReturnDebit ? sourceId : null) ||
          (entry.event_key === "order_update_net" ? sourceId : null) ||
          (isPaymentCredit || isPaymentOutDebit ? (sourcePayment?._id?.toString() || sourceId) : null),
        dateTime: asISO(entry.effective_at || entry.created_at),
        balance: runningBalance,
      };
    }).filter((t) => t.debit > 0 || t.credit > 0 || Math.abs(t.debit - t.credit) >= 0.01);

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
