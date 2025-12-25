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
    const expensesData = await transactionsCollection
      .find({
        type: 'expense',
        user_id: toObjectId(user.id),
        status: 'completed'
      })
      .toArray();

    const totalExpenses = expensesData?.reduce((sum, transaction) => sum + transaction.amount, 0) || 0;

    return NextResponse.json({ totalExpenses });
  } catch (error: any) {
    console.error('Expenses total error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch expenses data' }, { status: 401 });
  }
}
