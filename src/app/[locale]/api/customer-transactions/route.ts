import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/utils';
import {
  getCollection,
  COLLECTIONS,
  toObjectId,
  isValidObjectId,
  updateUserLastActivity,
} from '@/lib/db/mongodb';
import { appendCustomerLedgerEntry } from '@/lib/ledger/customer-ledger';
import { setDateToCurrentTime, generateReferenceNumber } from '@/lib/utils';
import { requireAnyPermission } from "@/lib/auth/rbac";

export async function GET(req: NextRequest) {
  try {
    const user = (await getCurrentUser()) as { id: string } | null;
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authCheck = await requireAnyPermission([
      "sales.view_payment_in", 
      "purchase.view_payment_out"
    ]);
    if (!authCheck.allowed) return authCheck.response!;

    const url = new URL(req.url);
    const type = url.searchParams.get('type') ?? 'payment-in';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    const collection = await getCollection(COLLECTIONS.CUSTOMER_TRANSACTIONS);
    const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);
    const paymentMethodCollection = await getCollection(COLLECTIONS.PAYMENT_METHODS);

    const filter = { user_id: toObjectId(user.id), type: type };
    
    const [items, totalCount] = await Promise.all([
      collection
        .find(filter)
        .sort({ date: -1 })
        .skip(limit === -1 ? 0 : skip)
        .limit(limit === -1 ? 0 : limit)
        .toArray(),
      collection.countDocuments(filter)
    ]);

    const customerIds = Array.from(new Set(items.map((i) => i.customer_id?.toString()).filter(Boolean))).filter(isValidObjectId);
    const allPaymentMethodIds = Array.from(new Set(items.map((i) => i.payment_method_id?.toString()).filter(Boolean)));
    const dbPaymentMethodIds = allPaymentMethodIds.filter(isValidObjectId);

    const customers = customerIds.length > 0
      ? await customersCollection.find({ _id: { $in: customerIds.map((id) => toObjectId(id)) } }).toArray()
      : [];
    const paymentMethodDocs = dbPaymentMethodIds.length > 0
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
      cash: 'Cash',
      cheque: 'Cheque',
      ...Object.fromEntries(
        paymentMethodDocs.map((pm) => [
          (pm._id as { toString: () => string }).toString(),
          (pm as { bank_name?: string }).bank_name ?? "",
        ])
      ),
    };

    const list = items.map((item) => ({
      id: (item._id as { toString: () => string }).toString(),
      paymentNumber: item.payment_number ?? item.paymentNumber ?? '',
      customerId: item.customer_id?.toString() ?? '',
      customerName: item.customer_id ? customerMap[item.customer_id.toString()] ?? '' : '',
      paymentAmount: item.payment_amount ?? 0,
      paymentMethodId: item.payment_method_id?.toString() ?? '',
      paymentMethodName: item.payment_method_id ? paymentMethodMap[item.payment_method_id.toString()] ?? '' : '',
      date: item.date ? new Date(item.date).toISOString().split('T')[0] : '',
      type: item.type ?? 'payment-in',
    }));

    await updateUserLastActivity();
    return NextResponse.json({
      transactions: list,
      totalCount,
      totalPages: limit === -1 ? 1 : Math.ceil(totalCount / limit),
      currentPage: page,
    });
  } catch (err: unknown) {
    console.error('customer-transactions GET error', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = (await getCurrentUser()) as { id: string } | null;
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authCheck = await requireAnyPermission([
      "sales.create_payment_in", 
      "purchase.create_payment_out"
    ]);
    if (!authCheck.allowed) return authCheck.response!;

    const body = await req.json();
    const type = body?.type ?? 'payment-in';
    const isPaymentIn = type === 'payment-in';
    const paymentNumber = body?.paymentNumber ?? body?.payment_number ?? generateReferenceNumber(isPaymentIn ? 'PAY-IN' : 'PAY-OUT');
    const customerId = body?.customerId ?? body?.customer_id ?? '';
    const paymentAmount = typeof body?.paymentAmount === 'number' ? body.paymentAmount : parseFloat(body?.paymentAmount) || 0;
    const paymentMethodId = body?.paymentMethodId ?? body?.payment_method_id ?? '';
    const dateStr = body?.date ?? new Date().toISOString().split('T')[0];

    if (!customerId || !isValidObjectId(customerId)) {
      return NextResponse.json({ error: 'Valid customer is required' }, { status: 400 });
    }
    const isHardcodedMethod = paymentMethodId === 'cash' || paymentMethodId === 'cheque';
    if (!paymentMethodId || (!isHardcodedMethod && !isValidObjectId(paymentMethodId))) {
      return NextResponse.json({ error: 'Valid payment method is required' }, { status: 400 });
    }
    if (paymentAmount <= 0) {
      return NextResponse.json({ error: 'Payment amount must be greater than 0' }, { status: 400 });
    }

    const date = setDateToCurrentTime(dateStr);

    const collection = await getCollection(COLLECTIONS.CUSTOMER_TRANSACTIONS);
    const now = new Date();
    const result = await collection.insertOne({
      user_id: toObjectId(user.id),
      customer_id: toObjectId(customerId),
      payment_number: paymentNumber,
      payment_amount: paymentAmount,
      payment_method_id: isHardcodedMethod ? paymentMethodId : toObjectId(paymentMethodId),
      date,
      type,
      created_at: now,
      updated_at: now,
    });

    const insertedId = result.insertedId;
    if (!insertedId) {
      return NextResponse.json({ error: 'Failed to create record' }, { status: 500 });
    }

    await appendCustomerLedgerEntry({
      userId: user.id,
      customerId,
      eventKey: `${isPaymentIn ? 'payment_in_credit' : 'payment_out_debit'}:${insertedId.toString()}`,
      eventType: isPaymentIn ? 'payment_in_credit' : 'payment_out_debit' as any,
      eventSource: 'party_transaction',
      eventSourceId: insertedId.toString(),
      amountDelta: isPaymentIn ? -paymentAmount : paymentAmount,
      effectiveAt: date,
      metadata: {
        payment_method_id: paymentMethodId,
        transaction_type: type,
        payment_number: paymentNumber,
      },
    });

    await updateUserLastActivity();
    return NextResponse.json({
      id: (insertedId as { toString: () => string }).toString(),
      paymentNumber,
      customerId,
      paymentAmount,
      paymentMethodId,
      date: date.toISOString().split('T')[0],
    });
  } catch (err: unknown) {
    console.error('customer-transactions POST error', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
