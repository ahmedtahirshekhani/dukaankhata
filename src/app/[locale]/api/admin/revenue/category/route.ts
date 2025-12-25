import { NextResponse } from 'next/server';
import { getCollection, COLLECTIONS, toObjectId } from '@/lib/mongodb';
import { getCurrentUser } from '@/lib/auth-utils';

export async function GET(request: Request) {
  const user = await getCurrentUser() as { id: string } | null;

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const transactionsCollection = await getCollection(COLLECTIONS.TRANSACTIONS);
  const revenueData = await transactionsCollection
    .find({
      status: 'completed',
      type: 'income',
      user_id: toObjectId(user.id)
    })
    .toArray();

  const revenueByCategory = revenueData?.reduce((acc, item) => {
    const category = item.category;
    if (!category) {
      return acc;
    }
    const revenue = item.amount;
    if (acc[category]) {
      acc[category] += revenue;
    } else {
      acc[category] = revenue;
    }
    return acc;
  }, {} as Record<string, number>);

  return NextResponse.json({ revenueByCategory });
}
