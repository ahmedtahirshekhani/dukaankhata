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

    const sellingTransactions = transactionsData?.filter(transaction => transaction.category === 'selling');
    const expenseTransactions = transactionsData?.filter(transaction => transaction.type === 'expense');

    if (!sellingTransactions || !expenseTransactions) {
      return NextResponse.json({ error: 'Failed to calculate profit margin' }, { status: 500 });
    }

    const totalSelling = sellingTransactions?.reduce((sum, transaction) => sum + transaction.amount, 0) || 0;
    const totalExpenses = expenseTransactions?.reduce((sum, transaction) => sum + transaction.amount, 0) || 0;

    const totalProfit = totalSelling - totalExpenses;

    return NextResponse.json({ totalProfit });
  } catch (error: any) {
    console.error('Profit total error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch profit data' }, { status: 401 });
  }
}