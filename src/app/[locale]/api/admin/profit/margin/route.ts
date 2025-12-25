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

    if (!transactionsData) {
      return NextResponse.json({ error: 'No transactions found' }, { status: 404 });
    }

    const profitMargin = calculateProfitMarginSeries(transactionsData);

    return NextResponse.json({ profitMargin });
  } catch (error: any) {
    console.error('Profit margin error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch profit margin data' }, { status: 401 });
  }
}

function calculateProfitMarginSeries(transactions: any[]) {
  const dailyData: { [key: string]: { selling: number; expense: number } } = {};

  transactions.forEach(transaction => {
    const createdAt = transaction.created_at instanceof Date 
      ? transaction.created_at.toISOString() 
      : String(transaction.created_at);
    const date = createdAt.split('T')[0];
    if (!dailyData[date]) {
      dailyData[date] = { selling: 0, expense: 0 };
    }

    if (transaction.category === 'selling') {
      dailyData[date].selling += transaction.amount;
    } else if (transaction.type === 'expense') {
      dailyData[date].expense += transaction.amount;
    }
  });

  const profitMarginSeries = Object.entries(dailyData).map(([date, data]) => {
    const { selling, expense } = data;
    const profit = selling - expense;
    const margin = selling > 0 ? (profit / selling) * 100 : 0;
    return {
      date,
      margin: parseFloat(margin.toFixed(2))
    };
  });

  return profitMarginSeries;
}
