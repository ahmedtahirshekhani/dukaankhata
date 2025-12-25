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
        status: 'completed',
        type: 'expense',
        user_id: toObjectId(user.id)
      })
      .toArray();

    const expensesByCategory = expensesData?.reduce((acc, item) => {
      const category = item.category;
      if (!category) {
        return acc;
      }
      const expenses = item.amount;
      if (acc[category]) {
        acc[category] += expenses;
      } else {
        acc[category] = expenses;
      }
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({ expensesByCategory });
  } catch (error: any) {
    console.error('Expenses category error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch expenses data' }, { status: 401 });
  }
}