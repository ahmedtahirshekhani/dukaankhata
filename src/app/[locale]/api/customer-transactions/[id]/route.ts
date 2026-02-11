import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getCurrentUser } from '@/lib/auth/utils';
import {
  getCollection,
  COLLECTIONS,
  toObjectId,
  isValidObjectId,
} from '@/lib/db/mongodb';

interface CustomerTransactionDoc {
  _id: ObjectId;
  user_id: ObjectId;
  customer_id: ObjectId;
  payment_amount: number;
  payment_method_id: ObjectId;
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = params.id;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const collection = await getCollection<CustomerTransactionDoc>(COLLECTIONS.CUSTOMER_TRANSACTIONS);
    const item = await collection.findOne({
      _id: toObjectId(id),
      user_id: toObjectId(user.id),
    });

    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const pmId = item.payment_method_id;
    return NextResponse.json({
      id: item._id.toString(),
      customerId: item.customer_id.toString(),
      paymentAmount: item.payment_amount,
      paymentMethodId: typeof pmId === 'string' ? pmId : pmId.toString(),
      date: new Date(item.date).toISOString().split('T')[0],
    });
  } catch (err: unknown) {
    console.error('customer-transactions GET [id] error', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = (await getCurrentUser()) as { id: string } | null;
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = params.id;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const body = await req.json();
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

    const date = new Date(dateStr + 'T12:00:00.000Z');

    const collection = await getCollection<CustomerTransactionDoc>(COLLECTIONS.CUSTOMER_TRANSACTIONS);
    const now = new Date();
    const result = await collection.findOneAndUpdate(
      { _id: toObjectId(id), user_id: toObjectId(user.id) },
      {
        $set: {
          customer_id: toObjectId(customerId),
          payment_amount: paymentAmount,
          payment_method_id: isHardcodedMethod ? paymentMethodId : toObjectId(paymentMethodId),
          date,
          updated_at: now,
        },
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const pmId = result.payment_method_id;
    return NextResponse.json({
      id: result._id.toString(),
      customerId: result.customer_id.toString(),
      paymentAmount: result.payment_amount,
      paymentMethodId: typeof pmId === 'string' ? pmId : pmId.toString(),
      date: new Date(result.date).toISOString().split('T')[0],
    });
  } catch (err: unknown) {
    console.error('customer-transactions PUT [id] error', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = (await getCurrentUser()) as { id: string } | null;
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = params.id;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const collection = await getCollection<CustomerTransactionDoc>(COLLECTIONS.CUSTOMER_TRANSACTIONS);
    const result = await collection.deleteOne({
      _id: toObjectId(id),
      user_id: toObjectId(user.id),
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Deleted successfully' });
  } catch (err: unknown) {
    console.error('customer-transactions DELETE [id] error', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
