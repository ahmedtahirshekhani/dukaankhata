import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth-utils';

export async function GET(request: Request) {
  const supabase = createClient();
  const user = await getCurrentUser() as { id: string } | null;

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { data: transactionsData, error: transactionsError } = await supabase
    .from('transactions')
    .select('amount, type, category, created_at')
    .eq('status', 'completed')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (transactionsError) {
    console.error('Error fetching transactions:', transactionsError);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }

  const sellingTransactions = transactionsData?.filter(transaction => transaction.category === 'selling');
  const expenseTransactions = transactionsData?.filter(transaction => transaction.type === 'expense');

  if (!sellingTransactions || !expenseTransactions) {
    return NextResponse.json({ error: 'Failed to calculate profit margin' }, { status: 500 });
  }

  const totalSelling = sellingTransactions?.reduce((sum, transaction) => sum + transaction.amount, 0) || 0;
  const totalExpenses = expenseTransactions?.reduce((sum, transaction) => sum + transaction.amount, 0) || 0;

  const totalProfit = totalSelling - totalExpenses;

  return NextResponse.json({ totalProfit });
}
