import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth-utils';

export async function GET(request: Request) {
  const supabase = createClient();
  const user = await getCurrentUser() as { id: string } | null;

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: expensesData, error: expensesError } = await supabase
    .from('transactions')
    .select('amount')
    .eq('type', 'expense')
    .eq('user_id', user.id)
    .eq('status', 'completed');

  if (expensesError) {
    console.error('Error fetching total expenses:', expensesError);
    return NextResponse.json({ error: 'Failed to fetch total expenses' }, { status: 500 });
  }

  const totalExpenses = expensesData?.reduce((sum, transaction) => sum + transaction.amount, 0) || 0;

  return NextResponse.json({ totalExpenses });
}
