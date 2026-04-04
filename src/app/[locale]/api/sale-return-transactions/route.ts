import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/utils";
import {
  getCollection,
  COLLECTIONS,
  toObjectId,
  isValidObjectId,
} from "@/lib/db/mongodb";
import { appendCustomerLedgerEntry } from "@/lib/ledger/customer-ledger";
import { setDateToCurrentTime } from "@/lib/utils";

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

export async function GET() {
  try {
    const user = (await getCurrentUser()) as { id: string } | null;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const collection = await getCollection(COLLECTIONS.SALE_RETURN_TRANSACTIONS);
    const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);
    const paymentMethodCollection = await getCollection(COLLECTIONS.PAYMENT_METHOD);

    const items = await collection
      .find({ user_id: toObjectId(user.id) })
      .sort({ date: -1 })
      .toArray();

    const customerIds = Array.from(
      new Set(items.map((i) => i.customer_id?.toString()).filter(Boolean))
    ).filter(isValidObjectId);

    const allPaymentMethodIds = Array.from(
      new Set(items.map((i) => i.payment_method_id?.toString()).filter(Boolean))
    );
    const dbPaymentMethodIds = allPaymentMethodIds.filter(isValidObjectId);

    const customers =
      customerIds.length > 0
        ? await customersCollection
            .find({ _id: { $in: customerIds.map((id) => toObjectId(id)) } })
            .toArray()
        : [];

    const paymentMethodDocs =
      dbPaymentMethodIds.length > 0
        ? await paymentMethodCollection
            .find({
              _id: { $in: dbPaymentMethodIds.map((id) => toObjectId(id)) },
              user_id: toObjectId(user.id),
            })
            .toArray()
        : [];

    const customerMap = Object.fromEntries(
      customers.map((c) => [c._id.toString(), c.name])
    );

    const paymentMethodMap: Record<string, string> = {
      cash: "Cash",
      cheque: "Cheque",
      ...Object.fromEntries(
        paymentMethodDocs.map((pm) => [
          (pm._id as { toString: () => string }).toString(),
          (pm as { bank_name?: string }).bank_name ?? "",
        ])
      ),
    };

    const list = items.map((item) => ({
      id: (item._id as { toString: () => string }).toString(),
      returnNumber: item.return_number ?? "",
      customerId: item.customer_id?.toString() ?? "",
      customerName: item.customer_id
        ? customerMap[item.customer_id.toString()] ?? ""
        : "",
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
      paymentMethodId: item.payment_method_id?.toString() ?? "",
      paymentMethodName: item.payment_method_id
        ? paymentMethodMap[item.payment_method_id.toString()] ?? ""
        : "",
      paymentRefNo: item.payment_ref_no ?? "",
      invoiceNo: item.invoice_no ?? "",
      invoiceDate: item.invoice_date
        ? new Date(item.invoice_date).toISOString().split("T")[0]
        : "",
      date: item.date ? new Date(item.date).toISOString().split("T")[0] : "",
    }));

    return NextResponse.json(list);
  } catch (err: unknown) {
    console.error("sale-return-transactions GET error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = (await getCurrentUser()) as { id: string } | null;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const collection = await getCollection(COLLECTIONS.SALE_RETURN_TRANSACTIONS);
    const now = new Date();
    const result = await collection.insertOne({
      user_id: toObjectId(user.id),
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
      created_at: now,
      updated_at: now,
    });

    const insertedId = result.insertedId;
    if (!insertedId) {
      return NextResponse.json(
        { error: "Failed to create record" },
        { status: 500 }
      );
    }

    await appendCustomerLedgerEntry({
      userId: user.id,
      customerId,
      eventKey: `sale_return_credit:${insertedId.toString()}`,
      eventType: "manual_adjustment",
      eventSource: "party_transaction",
      eventSourceId: insertedId.toString(),
      amountDelta: -paymentAmount,
      effectiveAt: date,
      metadata: {
        reason: "sale_return",
        payment_method_id: paymentMethodId,
      },
    });

    return NextResponse.json({
      id: (insertedId as { toString: () => string }).toString(),
      returnNumber,
      customerId,
      items: lineItems,
      totalAmount: paymentAmount,
      paidAmount,
      balanceDue,
      paymentAmount,
      paymentMethodId,
      paymentRefNo,
      invoiceNo,
      invoiceDate: invoiceDate ? invoiceDate.toISOString().split("T")[0] : "",
      date: date.toISOString().split("T")[0],
    });
  } catch (err: unknown) {
    console.error("sale-return-transactions POST error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
