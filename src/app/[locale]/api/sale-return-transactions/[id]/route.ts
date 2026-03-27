import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth/utils";
import {
  getCollection,
  COLLECTIONS,
  toObjectId,
  isValidObjectId,
} from "@/lib/db/mongodb";
import { appendCustomerLedgerEntry } from "@/lib/ledger/customer-ledger";
import { setDateToCurrentTime } from "@/lib/utils";

interface SaleReturnDoc {
  _id: ObjectId;
  user_id: ObjectId;
  customer_id: ObjectId;
  payment_amount: number;
  payment_method_id: ObjectId | string;
  date: Date;
  created_at?: Date;
  updated_at?: Date;
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
    return NextResponse.json({
      id: item._id.toString(),
      customerId: item.customer_id.toString(),
      paymentAmount: item.payment_amount,
      paymentMethodId: typeof pmId === "string" ? pmId : pmId.toString(),
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

    const id = params.id;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await req.json();
    const customerId = body?.customerId ?? body?.customer_id ?? "";
    const paymentAmount =
      typeof body?.paymentAmount === "number"
        ? body.paymentAmount
        : parseFloat(body?.paymentAmount) || 0;
    const paymentMethodId = body?.paymentMethodId ?? body?.payment_method_id ?? "";
    const dateStr = body?.date ?? new Date().toISOString().split("T")[0];

    if (!customerId || !isValidObjectId(customerId)) {
      return NextResponse.json(
        { error: "Valid customer is required" },
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

    const date = setDateToCurrentTime(dateStr);

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

    const oldCustomerId = existing.customer_id?.toString();
    const oldAmount = existing.payment_amount ?? 0;
    const newCustomerId = customerId;

    if (oldCustomerId && isValidObjectId(oldCustomerId) && oldAmount > 0) {
      await appendCustomerLedgerEntry({
        userId: user.id,
        customerId: oldCustomerId,
        eventKey: `sale_return_update_reversal:${id}:${oldCustomerId}:${oldAmount}:${new Date(existing.date).getTime()}`,
        eventType: "manual_adjustment",
        eventSource: "customer_transaction",
        eventSourceId: id,
        amountDelta: oldAmount,
        effectiveAt: new Date(),
        metadata: {
          reason: "sale_return_update_reversal",
          transaction_id: id,
        },
      });
    }

    if (newCustomerId && isValidObjectId(newCustomerId) && paymentAmount > 0) {
      await appendCustomerLedgerEntry({
        userId: user.id,
        customerId: newCustomerId,
        eventKey: `sale_return_update_apply:${id}:${newCustomerId}:${paymentAmount}:${date.getTime()}`,
        eventType: "manual_adjustment",
        eventSource: "customer_transaction",
        eventSourceId: id,
        amountDelta: -paymentAmount,
        effectiveAt: date,
        metadata: {
          reason: "sale_return_update_apply",
          transaction_id: id,
        },
      });
    }

    const now = new Date();
    const result = await collection.findOneAndUpdate(
      { _id: toObjectId(id), user_id: toObjectId(user.id) },
      {
        $set: {
          customer_id: toObjectId(customerId),
          payment_amount: paymentAmount,
          payment_method_id: isHardcodedMethod
            ? paymentMethodId
            : toObjectId(paymentMethodId),
          date,
          updated_at: now,
        },
      },
      { returnDocument: "after" }
    );

    if (!result) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const pmId = result.payment_method_id;
    return NextResponse.json({
      id: result._id.toString(),
      customerId: result.customer_id.toString(),
      paymentAmount: result.payment_amount,
      paymentMethodId: typeof pmId === "string" ? pmId : pmId.toString(),
      date: new Date(result.date).toISOString().split("T")[0],
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

    if (customerId && isValidObjectId(customerId) && paymentAmount > 0) {
      await appendCustomerLedgerEntry({
        userId: user.id,
        customerId,
        eventKey: `sale_return_delete_reversal:${id}:${customerId}:${paymentAmount}:${new Date(existing.date).getTime()}`,
        eventType: "manual_adjustment",
        eventSource: "customer_transaction",
        eventSourceId: id,
        amountDelta: paymentAmount,
        effectiveAt: new Date(),
        metadata: {
          reason: "sale_return_delete_reversal",
          transaction_id: id,
        },
      });
    }

    const result = await collection.deleteOne({
      _id: toObjectId(id),
      user_id: toObjectId(user.id),
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Deleted successfully" });
  } catch (err: unknown) {
    console.error("sale-return-transactions DELETE [id] error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
