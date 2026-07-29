import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCollection, COLLECTIONS, toObjectId, updateUserLastActivity } from '@/lib/db/mongodb';
import { requirePermission } from '@/lib/auth/rbac';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function GET() {
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

    const collection = await getCollection<{
      _id: unknown;
      user_id: unknown;
      bank_name: string;
      bank_details: string;
      created_at?: Date;
      updated_at?: Date;
    }>(COLLECTIONS.PAYMENT_METHOD);

    const items = await collection
      .find(
        { user_id: toObjectId(userId) },
        { projection: { _id: 1, bank_name: 1, bank_details: 1, created_at: 1, updated_at: 1 } }
      )
      .sort({ updated_at: -1 })
      .toArray();

    const list = items.map((item) => ({
      id: (item._id as { toString: () => string }).toString(),
      bankName: item.bank_name ?? '',
      bankDetails: item.bank_details ?? '',
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }));

    await updateUserLastActivity();
    return NextResponse.json(list);
  } catch (err: unknown) {
    console.error('payment-method GET error', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authCheck = await requirePermission('payment_methods.create');
    if (!authCheck.allowed) return authCheck.response!;

    const body = await req.json();
    const bankName = typeof body?.bankName === 'string' ? body.bankName.trim() : '';
    const bankDetails = typeof body?.bankDetails === 'string' ? body.bankDetails.trim() : '';

    if (!bankName) {
      return NextResponse.json({ error: 'Bank name is required' }, { status: 400 });
    }

    const collection = await getCollection(COLLECTIONS.PAYMENT_METHOD);
    const existing = await collection.findOne({
      user_id: toObjectId(userId),
      bank_name: { $regex: new RegExp(`^${escapeRegex(bankName)}$`, 'i') },
    });
    if (existing) {
      // Return existing method to allow SyncEngine to replace local ID with real DB ID
      return NextResponse.json({
        id: (existing._id as { toString: () => string }).toString(),
        bankName: existing.bank_name,
        bankDetails: existing.bank_details,
        createdAt: existing.created_at,
        updatedAt: existing.updated_at,
        message: 'Payment method already exists, returning existing'
      }, { status: 200 });
    }

    const now = new Date();
    const result = await collection.insertOne({
      user_id: toObjectId(userId),
      bank_name: bankName,
      bank_details: bankDetails,
      created_at: now,
      updated_at: now,
    });

    const insertedId = result.insertedId;
    if (!insertedId) {
      return NextResponse.json({ error: 'Failed to create payment method' }, { status: 500 });
    }

    await updateUserLastActivity();
    return NextResponse.json({
      id: (insertedId as { toString: () => string }).toString(),
      bankName,
      bankDetails,
      createdAt: now,
      updatedAt: now,
    });
  } catch (err: unknown) {
    console.error('payment-method POST error', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
