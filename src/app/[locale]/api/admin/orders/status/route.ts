import { NextResponse } from 'next/server';
import { getCollection, COLLECTIONS, toObjectId } from '@/lib/db/mongodb';
import { getCurrentUser } from '@/lib/auth/utils';

export async function GET(request: Request) {
  const user = await getCurrentUser() as { id: string } | null;

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ordersCollection = await getCollection(COLLECTIONS.ORDERS);
  
  const orders = await ordersCollection
    .find({
      user_id: toObjectId(user.id)
    })
    .toArray();

  // Group by status
  const ordersByStatus = orders?.reduce((acc, order) => {
    const status = order.status || 'unknown';
    if (acc[status]) {
      acc[status]++;
    } else {
      acc[status] = 1;
    }
    return acc;
  }, {} as Record<string, number>);

  return NextResponse.json({ ordersByStatus });
}
