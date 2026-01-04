import { NextResponse } from 'next/server';
import { getCollection, COLLECTIONS, toObjectId } from '@/lib/mongodb';
import { getCurrentUser } from '@/lib/auth-utils';

export async function GET(request: Request) {
  const user = await getCurrentUser() as { id: string } | null;

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ordersCollection = await getCollection(COLLECTIONS.ORDERS);
  
  // Get last 30 days of orders
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const orders = await ordersCollection
    .find({
      user_id: toObjectId(user.id),
      status: 'completed',
      created_at: { $gte: thirtyDaysAgo }
    })
    .sort({ created_at: 1 })
    .toArray();

  const revenueTrend = orders?.reduce((acc, order) => {
    const date = new Date(order.created_at).toISOString().split('T')[0];
    if (acc[date]) {
      acc[date] += order.total_amount || 0;
    } else {
      acc[date] = order.total_amount || 0;
    }
    return acc;
  }, {} as Record<string, number>);

  // Convert to array format for charts
  const trendData = Object.entries(revenueTrend).map(([date, revenue]) => ({
    date,
    revenue
  }));

  return NextResponse.json({ revenueTrend: trendData });
}
