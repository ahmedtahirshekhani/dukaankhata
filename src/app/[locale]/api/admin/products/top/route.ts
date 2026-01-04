import { NextResponse } from 'next/server';
import { getCollection, COLLECTIONS, toObjectId } from '@/lib/mongodb';
import { getCurrentUser } from '@/lib/auth-utils';

export async function GET(request: Request) {
  const user = await getCurrentUser() as { id: string } | null;

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ordersCollection = await getCollection(COLLECTIONS.ORDERS);
  const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
  
  const orders = await ordersCollection
    .find({
      user_id: toObjectId(user.id),
      status: 'completed'
    })
    .toArray();

  // Aggregate product sales
  const productSales: Record<string, { quantity: number; revenue: number; name: string }> = {};

  for (const order of orders) {
    if (order.items && Array.isArray(order.items)) {
      for (const item of order.items) {
        const productId = item.product_id?.toString() || 'unknown';
        if (!productSales[productId]) {
          productSales[productId] = {
            quantity: 0,
            revenue: 0,
            name: item.product_name || 'Unknown Product'
          };
        }
        productSales[productId].quantity += item.quantity || 0;
        productSales[productId].revenue += (item.quantity || 0) * (item.price || 0);
      }
    }
  }

  // Convert to array and sort by quantity, take top 5
  const topProducts = Object.values(productSales)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5)
    .map(product => ({
      name: product.name,
      quantity: product.quantity,
      revenue: product.revenue
    }));

  return NextResponse.json({ topProducts });
}
