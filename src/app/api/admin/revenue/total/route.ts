import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth-utils';

export async function GET(request: Request) {
  const supabase = createClient();
  const user = await getCurrentUser() as { id: string } | null;

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: revenueData, error: revenueError } = await supabase
    .from('transactions')
    .select('amount')
    .eq('type', 'income')
    .eq('user_id', user.id)
    .eq('status', 'completed');

  if (revenueError) {
    console.error('Error fetching total revenue:', revenueError);
    return NextResponse.json({ error: 'Failed to fetch total revenue' }, { status: 500 });
  }

  const totalRevenue = revenueData?.reduce((sum, order) => sum + order.amount, 0) || 0;

  return NextResponse.json({ totalRevenue });
}
