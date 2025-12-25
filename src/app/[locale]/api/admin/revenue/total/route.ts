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
    const revenueData = await transactionsCollection
      .find({
        type: 'income',
        user_id: toObjectId(user.id),
        status: 'completed'
      })
      .toArray();

    const totalRevenue = revenueData?.reduce((sum, order) => sum + order.amount, 0) || 0;

    return NextResponse.json({ totalRevenue });
  } catch (error: any) {
    console.error('Revenue total error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch revenue data' }, { status: 401 });
  }
}
