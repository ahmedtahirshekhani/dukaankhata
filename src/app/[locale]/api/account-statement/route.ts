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

    // Parallel queries
    const [customer, userDoc, rangeEntries, balanceState, openingBalanceAgg, paymentMethodsDocs] = await Promise.all([
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
      paymentMethodsCollection.find({ user_id: userId }).toArray()
    ]);

    const openingBalance = Number(
      openingBalanceAgg?.running_balance ?? customer?.opening_balance ?? 0
    );

    const paymentMethodMap = new Map<string, string>([
      ['cash', 'Cash'],
      ['cheque', 'Cheque'],
      ...(paymentMethodsDocs.map((pm: any) => [pm._id.toString(), pm.bank_name || ''] as [string, string]))
    ]);

    const rawEntries = rangeEntries.filter(
      (entry) => entry.event_type !== "opening_balance"
    );

    // Pre-process entries to collapse order edits and sale return edits
    const processedEntries: LedgerEntryDoc[] = [];
    const orderOriginals = new Map<string, LedgerEntryDoc>();
    const orderAdjustments = new Map<string, LedgerEntryDoc>();
    const srCreditOriginals = new Map<string, LedgerEntryDoc>();
    const srCreditAdjustments = new Map<string, LedgerEntryDoc>();
    const srDebitOriginals = new Map<string, LedgerEntryDoc>();
    const srDebitAdjustments = new Map<string, LedgerEntryDoc>();
    
    const paymentInOriginals = new Map<string, LedgerEntryDoc>();
    const paymentInAdjustments = new Map<string, LedgerEntryDoc>();
    const paymentOutOriginals = new Map<string, LedgerEntryDoc>();
    const paymentOutAdjustments = new Map<string, LedgerEntryDoc>();
    
    const pbDebitOriginals = new Map<string, LedgerEntryDoc>();
    const pbDebitAdjustments = new Map<string, LedgerEntryDoc>();
    const pbCreditOriginals = new Map<string, LedgerEntryDoc>();
    const pbCreditAdjustments = new Map<string, LedgerEntryDoc>();

    for (const entry of rawEntries) {
      const sourceIdStr = entry.event_source_id?.toString();
      const eventKeyStr = entry.event_key || "";

      // Order Folding
      if (entry.event_type === "order_debit" && sourceIdStr) {
        const newEntry = { 
          ...entry, 
          metadata: { 
            ...entry.metadata, 
            total_amount: Number((entry.metadata as any)?.total_amount ?? entry.amount_delta) 
          } 
        };
        orderOriginals.set(sourceIdStr, newEntry);
        processedEntries.push(newEntry);
      } else if (
        entry.event_type === "order_payment_credit" &&
        sourceIdStr
      ) {
        if (orderOriginals.has(sourceIdStr)) {
          // Fold payment into original order so invoice shows in one row with debit and credit
          const orig = orderOriginals.get(sourceIdStr)!;
          const paidAmt = Math.abs(Number(entry.amount_delta));
          orig.metadata = {
            ...orig.metadata,
            paid_amount: paidAmt,
            payment_method_id: (entry.metadata as any)?.payment_method_id
          };
          orig.amount_delta = Number(orig.amount_delta) + Number(entry.amount_delta);
        } else {
          processedEntries.push(entry);
        }
      } else if (
        entry.event_type === "manual_adjustment" && 
        (eventKeyStr.startsWith("order_update_reverse") || eventKeyStr.startsWith("order_update_apply")) &&
        sourceIdStr
      ) {
        if (orderOriginals.has(sourceIdStr)) {
          // Fold into original order within the same date range
          const orig = orderOriginals.get(sourceIdStr)!;
          orig.amount_delta = Number(orig.amount_delta) + Number(entry.amount_delta);
          if ((entry.metadata as any)?.newTotal !== undefined) {
            orig.metadata = {
              ...orig.metadata,
              total_amount: (entry.metadata as any).newTotal,
              paid_amount: (entry.metadata as any).newPaid,
            };
          }
        } else {
          // Fold into a single adjustment entry for this order (original order is outside date range)
          if (orderAdjustments.has(sourceIdStr)) {
            const adj = orderAdjustments.get(sourceIdStr)!;
            adj.amount_delta = Number(adj.amount_delta) + Number(entry.amount_delta);
          } else {
            const adj = { ...entry, event_key: "order_update_net", event_type: "manual_adjustment" };
            orderAdjustments.set(sourceIdStr, adj);
            processedEntries.push(adj);
          }
        }
      } 
      // Sale Return Credit Folding
      else if (entry.event_type === "sale_return_credit" && !eventKeyStr.startsWith("sale_return_update") && sourceIdStr) {
        const newEntry = { ...entry };
        srCreditOriginals.set(sourceIdStr, newEntry);
        processedEntries.push(newEntry);
      } else if (
        entry.event_type === "sale_return_credit" && 
        (eventKeyStr.startsWith("sale_return_update_reversal_credit") || eventKeyStr.startsWith("sale_return_update_apply_credit")) &&
        sourceIdStr
      ) {
        if (srCreditOriginals.has(sourceIdStr)) {
          const orig = srCreditOriginals.get(sourceIdStr)!;
          orig.amount_delta = Number(orig.amount_delta) + Number(entry.amount_delta);
        } else {
          if (srCreditAdjustments.has(sourceIdStr)) {
            const adj = srCreditAdjustments.get(sourceIdStr)!;
            adj.amount_delta = Number(adj.amount_delta) + Number(entry.amount_delta);
          } else {
            const adj = { ...entry, event_key: "sale_return_credit_net" };
            srCreditAdjustments.set(sourceIdStr, adj);
            processedEntries.push(adj);
          }
        }
      }
      // Sale Return Debit Folding
      else if (entry.event_type === "sale_return_debit" && !eventKeyStr.startsWith("sale_return_update") && sourceIdStr) {
        const newEntry = { ...entry };
        srDebitOriginals.set(sourceIdStr, newEntry);
        processedEntries.push(newEntry);
      } else if (
        entry.event_type === "sale_return_debit" && 
        (eventKeyStr.startsWith("sale_return_update_reversal_debit") || eventKeyStr.startsWith("sale_return_update_apply_debit")) &&
        sourceIdStr
      ) {
        if (srDebitOriginals.has(sourceIdStr)) {
          const orig = srDebitOriginals.get(sourceIdStr)!;
          orig.amount_delta = Number(orig.amount_delta) + Number(entry.amount_delta);
        } else {
          if (srDebitAdjustments.has(sourceIdStr)) {
            const adj = srDebitAdjustments.get(sourceIdStr)!;
            adj.amount_delta = Number(adj.amount_delta) + Number(entry.amount_delta);
          } else {
            const adj = { ...entry, event_key: "sale_return_debit_net" };
            srDebitAdjustments.set(sourceIdStr, adj);
            processedEntries.push(adj);
          }
        }
      } 
      // Payment In Folding
      else if (entry.event_type === "payment_in_credit" && sourceIdStr) {
        if (!paymentInOriginals.has(sourceIdStr)) {
          const newEntry = { ...entry };
          paymentInOriginals.set(sourceIdStr, newEntry);
          processedEntries.push(newEntry);
        } else {
          const orig = paymentInOriginals.get(sourceIdStr)!;
          orig.amount_delta = Number(orig.amount_delta) + Number(entry.amount_delta);
          if (entry.metadata) orig.metadata = { ...orig.metadata, ...entry.metadata };
          orig.effective_at = entry.effective_at;
        }
      } else if (
        entry.event_type === "manual_adjustment" &&
        (eventKeyStr.startsWith("payment_in_") || (entry.metadata as any)?.old_type === "payment-in" || (entry.metadata as any)?.type === "payment-in") &&
        sourceIdStr
      ) {
        if (paymentInOriginals.has(sourceIdStr)) {
          const orig = paymentInOriginals.get(sourceIdStr)!;
          orig.amount_delta = Number(orig.amount_delta) + Number(entry.amount_delta);
        } else {
          if (paymentInAdjustments.has(sourceIdStr)) {
            const adj = paymentInAdjustments.get(sourceIdStr)!;
            adj.amount_delta = Number(adj.amount_delta) + Number(entry.amount_delta);
          } else {
            const adj = { ...entry, event_key: "payment_in_net", event_type: "manual_adjustment" };
            paymentInAdjustments.set(sourceIdStr, adj);
            processedEntries.push(adj);
          }
        }
      }
      // Payment Out Folding
      else if (entry.event_type === "payment_out_debit" && sourceIdStr) {
        if (!paymentOutOriginals.has(sourceIdStr)) {
          const newEntry = { ...entry };
          paymentOutOriginals.set(sourceIdStr, newEntry);
          processedEntries.push(newEntry);
        } else {
          const orig = paymentOutOriginals.get(sourceIdStr)!;
          orig.amount_delta = Number(orig.amount_delta) + Number(entry.amount_delta);
          if (entry.metadata) orig.metadata = { ...orig.metadata, ...entry.metadata };
          orig.effective_at = entry.effective_at;
        }
      } else if (
        entry.event_type === "manual_adjustment" &&
        (eventKeyStr.startsWith("payment_out_") || (entry.metadata as any)?.old_type === "payment-out" || (entry.metadata as any)?.type === "payment-out") &&
        sourceIdStr
      ) {
        if (paymentOutOriginals.has(sourceIdStr)) {
          const orig = paymentOutOriginals.get(sourceIdStr)!;
          orig.amount_delta = Number(orig.amount_delta) + Number(entry.amount_delta);
        } else {
          if (paymentOutAdjustments.has(sourceIdStr)) {
            const adj = paymentOutAdjustments.get(sourceIdStr)!;
            adj.amount_delta = Number(adj.amount_delta) + Number(entry.amount_delta);
          } else {
            const adj = { ...entry, event_key: "payment_out_net", event_type: "manual_adjustment" };
            paymentOutAdjustments.set(sourceIdStr, adj);
            processedEntries.push(adj);
          }
        }
      }
      // Purchase Bill Debit Folding
      else if (entry.event_type === "purchase_bill_debit" && sourceIdStr) {
        if (!pbDebitOriginals.has(sourceIdStr)) {
          const totalAmt = Number((entry.metadata as any)?.total_amount ?? Math.abs(entry.amount_delta));
          const newEntry = { 
            ...entry,
            amount_delta: -totalAmt,
            metadata: { 
              ...entry.metadata, 
              total_amount: totalAmt 
            } 
          };
          pbDebitOriginals.set(sourceIdStr, newEntry);
          processedEntries.push(newEntry);
        } else {
          const orig = pbDebitOriginals.get(sourceIdStr)!;
          orig.amount_delta = Number(orig.amount_delta) + Number(entry.amount_delta);
          if (entry.metadata) orig.metadata = { ...orig.metadata, ...entry.metadata };
          orig.effective_at = entry.effective_at;
        }
      } else if (
        entry.event_type === "purchase_bill_credit" &&
        sourceIdStr
      ) {
        if (pbDebitOriginals.has(sourceIdStr)) {
          // Fold payment into original purchase bill
          const orig = pbDebitOriginals.get(sourceIdStr)!;
          const paidAmt = Math.abs(Number((entry.metadata as any)?.paid_amount ?? entry.amount_delta));
          orig.metadata = {
            ...orig.metadata,
            paid_amount: paidAmt,
            payment_method_id: (entry.metadata as any)?.payment_method_id
          };
          orig.amount_delta = Number(orig.amount_delta) + paidAmt;
        } else {
          const paidAmt = Math.abs(Number((entry.metadata as any)?.paid_amount ?? entry.amount_delta));
          processedEntries.push({
            ...entry,
            amount_delta: paidAmt,
          });
        }
      } else if (
        entry.event_type === "manual_adjustment" &&
        (eventKeyStr.startsWith("purchase_bill_revert_") || eventKeyStr.startsWith("purchase_bill_payment_revert_") || eventKeyStr.startsWith("purchase_bill_")) &&
        sourceIdStr
      ) {
        if (pbDebitOriginals.has(sourceIdStr)) {
          const orig = pbDebitOriginals.get(sourceIdStr)!;
          orig.amount_delta = Number(orig.amount_delta) + Number(entry.amount_delta);
        } else {
          if (pbDebitAdjustments.has(sourceIdStr)) {
            const adj = pbDebitAdjustments.get(sourceIdStr)!;
            adj.amount_delta = Number(adj.amount_delta) + Number(entry.amount_delta);
          } else {
            const adj = { ...entry, event_key: "purchase_bill_debit_net", event_type: "manual_adjustment" };
            pbDebitAdjustments.set(sourceIdStr, adj);
            processedEntries.push(adj);
          }
        }
      }
      // All other entries
      else {
        processedEntries.push(entry);
      }
    }

    const entries = processedEntries.filter(
      (e) =>
        e.event_type === "order_debit" ||
        e.event_type === "purchase_bill_debit" ||
        Math.abs(Number(e.amount_delta)) >= 0.01
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
          expandedItems = saleReturnItems.map((item: any) => {
            const qty = parseFloat(item.quantity) || 0;
            const prc = parseFloat(item.price) || 0;
            return {
              name: item.itemName || item.name || "Item",
              quantity: qty,
              price: prc,
              amount: qty * prc
            };
          });
        }
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
        const totalAmount = Number((entry.metadata as any)?.total_amount ?? sourceOrder?.total_amount ?? (amountDelta >= 0 ? amountDelta : 0));
        const paidAmount = Number((entry.metadata as any)?.paid_amount ?? sourceOrder?.payment?.paid_amount ?? 0);
        debit = totalAmount;
        credit = paidAmount;
        amount = totalAmount;
      } else if (isPurchaseBillDebit) {
        const totalAmount = Number((entry.metadata as any)?.total_amount ?? sourcePurchaseBill?.total_amount ?? Math.abs(amountDelta));
        const paidAmount = Number((entry.metadata as any)?.paid_amount ?? sourcePurchaseBill?.paid_amount ?? 0);
        debit = paidAmount;
        credit = totalAmount;
        amount = totalAmount;
      } else if (isPaymentOutDebit || isSaleReturnDebit || isPurchaseBillCredit) {
        debit = amount;
        credit = 0;
      } else if (isPaymentCredit || isSaleReturnCredit) {
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
      orderId: null, // Removed hardcoded OP-76
      dateTime: openingDate,
      balance: openingBalance,
    };

    const totalOrdersGross = entries
      .filter((entry) => entry.event_type === "order_debit")
      .reduce((sum, entry) => {
        const totalAmount = Number((entry.metadata as any)?.total_amount ?? Math.abs(Number(entry.amount_delta || 0)));
        return sum + totalAmount;
      }, 0);

    const totalSaleReturns = entries
      .filter((entry) => entry.event_type === "sale_return_credit")
      .reduce((sum, entry) => sum + Math.abs(Number(entry.amount_delta || 0)), 0);

    const totalOrders = totalOrdersGross - totalSaleReturns;

    const totalPurchaseBills = entries
      .filter((entry) => entry.event_type === "purchase_bill_debit")
      .reduce((sum, entry) => {
        const totalAmount = Number((entry.metadata as any)?.total_amount ?? Math.abs(Number(entry.amount_delta || 0)));
        return sum + totalAmount;
      }, 0);

    const totalPaymentsIn = entries
      .reduce((sum, entry) => {
        if (entry.event_type === "payment_in_credit" || entry.event_type === "order_payment_credit") {
          return sum + Math.abs(Number(entry.amount_delta || 0));
        }
        if (entry.event_type === "order_debit") {
          const paidAmt = Number((entry.metadata as any)?.paid_amount ?? 0);
          return sum + paidAmt;
        }
        return sum;
      }, 0);

    const totalPaymentsOut = entries
      .reduce((sum, entry) => {
        if (entry.event_type === "payment_out_debit" || entry.event_type === "sale_return_debit" || entry.event_type === "purchase_bill_credit") {
          return sum + Math.abs(Number(entry.amount_delta || 0));
        }
        if (entry.event_type === "purchase_bill_debit") {
          const paidAmt = Number((entry.metadata as any)?.paid_amount ?? 0);
          return sum + paidAmt;
        }
        return sum;
      }, 0);

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
    console.error("account-statement-latest GET error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
