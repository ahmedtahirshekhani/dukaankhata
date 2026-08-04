import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth/utils";
import {
  getCollection,
  COLLECTIONS,
  toObjectId,
  isValidObjectId,
  setLastUpdated,
  updateUserLastActivity,
} from "@/lib/db/mongodb";
import { appendCustomerLedgerEntry } from "@/lib/ledger/customer-ledger";
import { setDateToCurrentTime } from "@/lib/utils";
import { requirePermission } from "@/lib/auth/rbac";

interface SaleReturnDoc {
  _id: ObjectId;
  user_id: ObjectId;
  return_number?: string;
  customer_id: ObjectId;
  items?: Array<{
    id: string;
    productId?: string;
    itemName: string;
    quantity: number;
    rate: number;
    amount: number;
  }>;
  total_amount?: number;
  paid_amount?: number;
  balance_due?: number;
  payment_amount: number;
  payment_method_id: ObjectId | string;
  payment_ref_no?: string;
  invoice_no?: string;
  invoice_date?: Date | null;
  date: Date;
  created_at?: Date;
  updated_at?: Date;
}

type SaleReturnItem = {
  id: string;
  productId?: string;
  itemName: string;
  quantity: number;
  rate: number;
  amount: number;
};

function sanitizeItems(items: unknown): SaleReturnItem[] {
  if (!Array.isArray(items)) return [];

  return items
    .map((raw, index) => {
      const item = raw as {
        id?: string;
        productId?: string;
        itemName?: string;
        quantity?: number | string;
        rate?: number | string;
        amount?: number | string;
      };
      const quantity =
        typeof item.quantity === "number"
          ? item.quantity
          : parseFloat(item.quantity ?? "0") || 0;
      const rate =
        typeof item.rate === "number" ? item.rate : parseFloat(item.rate ?? "0") || 0;
      const fallbackAmount = Number((quantity * rate).toFixed(2));
      const amount =
        typeof item.amount === "number"
          ? item.amount
          : parseFloat(item.amount ?? "0") || fallbackAmount;

      return {
        id: item.id?.toString() || `item-${index + 1}`,
        productId: item.productId?.toString() || "",
        itemName: item.itemName?.toString().trim() || "",
        quantity,
        rate,
        amount,
      };
    })
    .filter((item) => item.itemName && item.amount > 0);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = (await getCurrentUser()) as { id: string } | null;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const authCheck = await requirePermission("sales.view_sale_return");
    if (!authCheck.allowed) return authCheck.response!;

    const id = params.id;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const collection = await getCollection<SaleReturnDoc>(
      COLLECTIONS.SALE_RETURN_TRANSACTIONS
    );

    const item = await collection.findOne({
      _id: toObjectId(id),
      user_id: toObjectId(user.id),
    });

    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const pmId = item.payment_method_id;
    await updateUserLastActivity();
    return NextResponse.json({
      id: item._id.toString(),
      returnNumber: item.return_number ?? "",
      customerId: item.customer_id.toString(),
      items: Array.isArray(item.items) ? item.items : [],
      totalAmount: item.total_amount ?? item.payment_amount ?? 0,
      paidAmount: item.paid_amount ?? 0,
      balanceDue:
        item.balance_due ??
        Number(
          (
            (item.total_amount ?? item.payment_amount ?? 0) -
            (item.paid_amount ?? 0)
          ).toFixed(2)
        ),
      paymentAmount: item.payment_amount ?? item.total_amount ?? 0,
      paymentMethodId: typeof pmId === "string" ? pmId : pmId.toString(),
      paymentRefNo: item.payment_ref_no ?? "",
      invoiceNo: item.invoice_no ?? "",
      invoiceDate: item.invoice_date
        ? new Date(item.invoice_date).toISOString().split("T")[0]
        : "",
      date: new Date(item.date).toISOString().split("T")[0],
    });
  } catch (err: unknown) {
    console.error("sale-return-transactions GET [id] error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = (await getCurrentUser()) as { id: string } | null;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const authCheck = await requirePermission("sales.edit_sale_return");
    if (!authCheck.allowed) return authCheck.response!;

    const id = params.id;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await req.json();
    const customerId = body?.customerId ?? body?.customer_id ?? "";
    const returnNumber = (body?.returnNumber ?? body?.return_number ?? "").toString().trim();
    const lineItems = sanitizeItems(body?.items);
    const totalAmount =
      typeof body?.totalAmount === "number"
        ? body.totalAmount
        : parseFloat(body?.totalAmount) || 0;
    const paidAmount =
      typeof body?.paidAmount === "number"
        ? body.paidAmount
        : parseFloat(body?.paidAmount) || 0;
    const paymentAmount = totalAmount;
    const balanceDue = Number((paymentAmount - paidAmount).toFixed(2));
    const paymentMethodId = body?.paymentMethodId ?? body?.payment_method_id ?? "";
    const paymentRefNo = (body?.paymentRefNo ?? body?.payment_ref_no ?? "")
      .toString()
      .trim();
    const invoiceNo = (body?.invoiceNo ?? body?.invoice_no ?? "").toString().trim();
    const invoiceDateRaw = (body?.invoiceDate ?? body?.invoice_date ?? "")
      .toString()
      .trim();
    const dateStr = body?.date ?? new Date().toISOString().split("T")[0];

    if (!customerId || !isValidObjectId(customerId)) {
      return NextResponse.json(
        { error: "Valid customer is required" },
        { status: 400 }
      );
    }

    if (!returnNumber) {
      return NextResponse.json(
        { error: "Return number is required" },
        { status: 400 }
      );
    }

    const isHardcodedMethod = paymentMethodId === "cash" || paymentMethodId === "cheque";
    if (!paymentMethodId || (!isHardcodedMethod && !isValidObjectId(paymentMethodId))) {
      return NextResponse.json(
        { error: "Valid payment method is required" },
        { status: 400 }
      );
    }

    if (paymentAmount <= 0) {
      return NextResponse.json(
        { error: "Sale return amount must be greater than 0" },
        { status: 400 }
      );
    }

    if (paidAmount < 0 || paidAmount > paymentAmount) {
      return NextResponse.json(
        { error: "Paid amount must be between 0 and total amount" },
        { status: 400 }
      );
    }

    if (lineItems.length === 0) {
      return NextResponse.json(
        { error: "At least one return item is required" },
        { status: 400 }
      );
    }

    const date = setDateToCurrentTime(dateStr);
    const invoiceDate = invoiceDateRaw ? setDateToCurrentTime(invoiceDateRaw) : null;

    const collection = await getCollection<SaleReturnDoc>(
      COLLECTIONS.SALE_RETURN_TRANSACTIONS
    );

    const existing = await collection.findOne({
      _id: toObjectId(id),
      user_id: toObjectId(user.id),
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Ledger adjustments (reverse old, apply new)
    const oldCustomerId = existing.customer_id?.toString();
    const oldAmount = existing.payment_amount ?? 0;
    const oldPaidAmount = existing.paid_amount ?? 0;
    const newCustomerId = customerId;

    if (oldCustomerId && isValidObjectId(oldCustomerId)) {
      if (oldAmount > 0) {
        await appendCustomerLedgerEntry({
          userId: user.id,
          customerId: oldCustomerId,
          eventKey: `sale_return_update_reversal_credit:${id}:${oldCustomerId}:${oldAmount}:${new Date(existing.date).getTime()}`,
          eventType: "sale_return_credit",
          eventSource: "party_transaction",
          eventSourceId: id,
          amountDelta: oldAmount,
          effectiveAt: new Date(),
          metadata: {
            reason: "sale_return_update_reversal",
            transaction_id: id,
          },
        });
      }
      if (oldPaidAmount > 0) {
        await appendCustomerLedgerEntry({
          userId: user.id,
          customerId: oldCustomerId,
          eventKey: `sale_return_update_reversal_debit:${id}:${oldCustomerId}:${oldPaidAmount}:${new Date(existing.date).getTime()}`,
          eventType: "sale_return_debit",
          eventSource: "party_transaction",
          eventSourceId: id,
          amountDelta: -oldPaidAmount,
          effectiveAt: new Date(),
          metadata: {
            reason: "sale_return_update_reversal_refund",
            transaction_id: id,
          },
        });
        
        // Remove old refund transaction from transactions collection
        const transactionsCollection = await getCollection(COLLECTIONS.TRANSACTIONS);
        await transactionsCollection.deleteOne({ order_id: toObjectId(id) });
      }
    }

    if (newCustomerId && isValidObjectId(newCustomerId)) {
      if (paymentAmount > 0) {
        await appendCustomerLedgerEntry({
          userId: user.id,
          customerId: newCustomerId,
          eventKey: `sale_return_update_apply_credit:${id}:${newCustomerId}:${paymentAmount}:${date.getTime()}`,
          eventType: "sale_return_credit",
          eventSource: "party_transaction",
          eventSourceId: id,
          amountDelta: -paymentAmount,
          effectiveAt: date,
          metadata: {
            reason: "sale_return_update_apply",
            transaction_id: id,
          },
        });
      }
      if (paidAmount > 0) {
        await appendCustomerLedgerEntry({
          userId: user.id,
          customerId: newCustomerId,
          eventKey: `sale_return_update_apply_debit:${id}:${newCustomerId}:${paidAmount}:${date.getTime()}`,
          eventType: "sale_return_debit",
          eventSource: "party_transaction",
          eventSourceId: id,
          amountDelta: paidAmount,
          effectiveAt: date,
          metadata: {
            reason: "sale_return_update_apply_refund",
            transaction_id: id,
          },
        });
        
        // Add new refund transaction
        const transactionsCollection = await getCollection(COLLECTIONS.TRANSACTIONS);
        await transactionsCollection.insertOne({
          user_id: toObjectId(user.id),
          amount: paidAmount,
          status: "completed",
          category: "selling", // or refund
          type: "expense", // cash out
          description: `Refund for sale return #${returnNumber}`,
          payment_date: date,
          payment_method_id: isHardcodedMethod ? paymentMethodId : toObjectId(paymentMethodId),
          order_id: toObjectId(id),
          created_at: new Date(),
        });
      }
    }

    // ✅ Use setLastUpdated helper instead of manual $set
    const filter = { _id: toObjectId(id), user_id: toObjectId(user.id) };
    const updateData = {
      return_number: returnNumber,
      customer_id: toObjectId(customerId),
      items: lineItems,
      total_amount: paymentAmount,
      paid_amount: paidAmount,
      balance_due: balanceDue,
      payment_amount: paymentAmount,
      payment_method_id: isHardcodedMethod
        ? paymentMethodId
        : toObjectId(paymentMethodId),
      payment_ref_no: paymentRefNo,
      invoice_no: invoiceNo,
      invoice_date: invoiceDate,
      date,
    };

    const updateResult = await setLastUpdated(collection, filter, updateData);

    if (updateResult.matchedCount === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Fetch updated document
    const updated = await collection.findOne(filter);
    if (!updated) {
      return NextResponse.json({ error: "Not found after update" }, { status: 404 });
    }

    // ✅ Update user's last activity
    const usersCollection = await getCollection(COLLECTIONS.USERS);
    await setLastUpdated(usersCollection, { _id: toObjectId(user.id) });

    const pmId = updated.payment_method_id;
    await updateUserLastActivity();
    return NextResponse.json({
      id: updated._id.toString(),
      returnNumber: updated.return_number ?? "",
      customerId: updated.customer_id.toString(),
      items: Array.isArray(updated.items) ? updated.items : [],
      totalAmount: updated.total_amount ?? updated.payment_amount ?? 0,
      paidAmount: updated.paid_amount ?? 0,
      balanceDue:
        updated.balance_due ??
        Number(
          (
            (updated.total_amount ?? updated.payment_amount ?? 0) -
            (updated.paid_amount ?? 0)
          ).toFixed(2)
        ),
      paymentAmount: updated.payment_amount ?? updated.total_amount ?? 0,
      paymentMethodId: typeof pmId === "string" ? pmId : pmId.toString(),
      paymentRefNo: updated.payment_ref_no ?? "",
      invoiceNo: updated.invoice_no ?? "",
      invoiceDate: updated.invoice_date
        ? new Date(updated.invoice_date).toISOString().split("T")[0]
        : "",
      date: new Date(updated.date).toISOString().split("T")[0],
    });
  } catch (err: unknown) {
    console.error("sale-return-transactions PUT [id] error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = (await getCurrentUser()) as { id: string } | null;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const authCheck = await requirePermission("sales.delete_sale_return");
    if (!authCheck.allowed) return authCheck.response!;

    const id = params.id;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const collection = await getCollection<SaleReturnDoc>(
      COLLECTIONS.SALE_RETURN_TRANSACTIONS
    );

    const existing = await collection.findOne({
      _id: toObjectId(id),
      user_id: toObjectId(user.id),
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const customerId = existing.customer_id?.toString();
    const paymentAmount = existing.payment_amount ?? 0;
    const paidAmount = existing.paid_amount ?? 0;

    if (customerId && isValidObjectId(customerId)) {
      if (paymentAmount > 0) {
        await appendCustomerLedgerEntry({
          userId: user.id,
          customerId,
          eventKey: `sale_return_delete_reversal_credit:${id}:${customerId}:${paymentAmount}:${new Date(existing.date).getTime()}`,
          eventType: "sale_return_credit",
          eventSource: "party_transaction",
          eventSourceId: id,
          amountDelta: paymentAmount,
          effectiveAt: new Date(),
          metadata: {
            reason: "sale_return_delete_reversal",
            transaction_id: id,
          },
        });
      }
      if (paidAmount > 0) {
        await appendCustomerLedgerEntry({
          userId: user.id,
          customerId,
          eventKey: `sale_return_delete_reversal_debit:${id}:${customerId}:${paidAmount}:${new Date(existing.date).getTime()}`,
          eventType: "sale_return_debit",
          eventSource: "party_transaction",
          eventSourceId: id,
          amountDelta: -paidAmount,
          effectiveAt: new Date(),
          metadata: {
            reason: "sale_return_delete_reversal_refund",
            transaction_id: id,
          },
        });
        
        // Remove refund transaction from transactions collection
        const transactionsCollection = await getCollection(COLLECTIONS.TRANSACTIONS);
        await transactionsCollection.deleteOne({ order_id: toObjectId(id) });
      }
    }

    const result = await collection.deleteOne({
      _id: toObjectId(id),
      user_id: toObjectId(user.id),
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // ✅ Update user's last activity after deletion
    const usersCollection = await getCollection(COLLECTIONS.USERS);
    await setLastUpdated(usersCollection, { _id: toObjectId(user.id) });

    await updateUserLastActivity();
    return NextResponse.json({ message: "Deleted successfully" });
  } catch (err: unknown) {
    console.error("sale-return-transactions DELETE [id] error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";