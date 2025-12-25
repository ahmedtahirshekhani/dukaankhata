import { NextResponse } from 'next/server';
import { getCollection, COLLECTIONS, toObjectId } from '@/lib/mongodb';
import { getCurrentUser } from '@/lib/auth-utils';

export async function GET(request: Request) {
  try {
    let user;
    try {
      user = await getCurrentUser() as { id: string };
    } catch (error) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.id || typeof user.id !== 'string' || user.id.length !== 24) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const transactionsCollection = await getCollection(COLLECTIONS.TRANSACTIONS);
    const transactionsData = await transactionsCollection
      .find({
        status: 'completed',
        user_id: toObjectId(user.id)
      })
      .sort({ created_at: 1 })
      .toArray();

    const cashFlow = transactionsData?.reduce((acc, transaction) => {
      const date = new Date(transaction.created_at).toISOString().split('T')[0];
      if (acc[date]) {
        acc[date] += transaction.amount;
      } else {
        acc[date] = transaction.amount;
      }
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({ cashFlow });
  } catch (error: any) {
    console.error('Cashflow error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch cashflow data' }, { status: 401 });
  }
}
