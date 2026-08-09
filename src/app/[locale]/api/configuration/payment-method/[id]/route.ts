
import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { auth } from '@/auth';
import { requirePermission } from '@/lib/auth/rbac';
import {
  getCollection,
  COLLECTIONS,
  toObjectId,
  isValidObjectId,
  setLastUpdated,
  updateUserLastActivity,
} from '@/lib/db/mongodb';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface PaymentMethodDoc {
  _id: ObjectId;
  user_id: ObjectId;
  bank_name: string;
  bank_details: string;
  opening_balance?: number;
  created_at?: Date;
  updated_at?: Date;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authCheck = await requirePermission('payment_methods.view');
    if (!authCheck.allowed) return authCheck.response!;

    const id = params.id;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const collection = await getCollection<PaymentMethodDoc>(COLLECTIONS.PAYMENT_METHODS);
    const item = await collection.findOne({
      _id: toObjectId(id),
      user_id: toObjectId(userId),
    });

    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await updateUserLastActivity();
    return NextResponse.json({
      id: item._id.toString(),
      bankName: item.bank_name ?? '',
      bankDetails: item.bank_details ?? '',
      openingBalance: item.opening_balance ?? 0,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    });
  } catch (err: unknown) {
    console.error('payment-method GET [id] error', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authCheck = await requirePermission('payment_methods.edit');
    if (!authCheck.allowed) return authCheck.response!;

    const id = params.id;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const body = await req.json();
    const bankName = typeof body?.bankName === 'string' ? body.bankName.trim() : '';
    const bankDetails = typeof body?.bankDetails === 'string' ? body.bankDetails.trim() : '';
    const openingBalance = typeof body?.openingBalance === 'number' ? body.openingBalance : 0;

    if (!bankName) {
      return NextResponse.json({ error: 'Bank name is required' }, { status: 400 });
    }

    const collection = await getCollection<PaymentMethodDoc>(COLLECTIONS.PAYMENT_METHODS);

    // Check for duplicate bank name
    const duplicate = await collection.findOne({
      user_id: toObjectId(userId),
      _id: { $ne: toObjectId(id) },
      bank_name: { $regex: new RegExp(`^${escapeRegex(bankName)}$`, 'i') },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: 'A payment method with this bank name already exists' },
        { status: 409 }
      );
    }

    const updateResult = await setLastUpdated(
      collection,
      { _id: toObjectId(id), user_id: toObjectId(userId) },
      { bank_name: bankName, bank_details: bankDetails, opening_balance: openingBalance }
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Fetch updated document to return
    const updatedDoc = await collection.findOne({
      _id: toObjectId(id),
      user_id: toObjectId(userId),
    });

    if (!updatedDoc) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await updateUserLastActivity();
    return NextResponse.json({
      id: updatedDoc._id.toString(),
      bankName: updatedDoc.bank_name ?? '',
      bankDetails: updatedDoc.bank_details ?? '',
      openingBalance: updatedDoc.opening_balance ?? 0,
      createdAt: updatedDoc.created_at,
      updatedAt: updatedDoc.updated_at,
    });
  } catch (err: unknown) {
    console.error('payment-method PUT [id] error', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authCheck = await requirePermission('payment_methods.delete');
    if (!authCheck.allowed) return authCheck.response!;

    const id = params.id;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const collection = await getCollection<PaymentMethodDoc>(COLLECTIONS.PAYMENT_METHODS);
    const result = await collection.deleteOne({
      _id: toObjectId(id),
      user_id: toObjectId(userId),
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await updateUserLastActivity();
    return NextResponse.json({ message: 'Deleted successfully' });
  } catch (err: unknown) {
    console.error('payment-method DELETE [id] error', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';