import { NextResponse } from 'next/server';
import { getCollection, COLLECTIONS, toObjectId } from '@/lib/mongodb';
import { getCurrentUser } from '@/lib/auth-utils';

export async function GET(request: Request) {
  const user = await getCurrentUser() as { id: string } | null;

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const transactionsCollection = await getCollection(COLLECTIONS.TRANSACTIONS);
  const paymentMethodsCollection = await getCollection(COLLECTIONS.PAYMENT_METHODS);
  
  const transactions = await transactionsCollection
    .find({
      user_id: toObjectId(user.id),
      status: 'completed',
      type: 'income'
    })
    .toArray();

  // Get all payment methods
  const paymentMethods = await paymentMethodsCollection.find({}).toArray();
  const paymentMethodMap = paymentMethods.reduce((acc, pm) => {
    acc[pm._id.toString()] = pm.name;
    return acc;
  }, {} as Record<string, string>);

  // Aggregate by payment method
  const paymentDistribution = transactions?.reduce((acc, transaction) => {
    const methodId = transaction.payment_method_id?.toString();
    const methodName = methodId && paymentMethodMap[methodId] ? paymentMethodMap[methodId] : 'Unknown';
    
    if (acc[methodName]) {
      acc[methodName] += transaction.amount || 0;
    } else {
      acc[methodName] = transaction.amount || 0;
    }
    return acc;
  }, {} as Record<string, number>);

  return NextResponse.json({ paymentDistribution });
}
