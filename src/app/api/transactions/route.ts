import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-utils'

export async function GET(request: Request) {
  const supabase = createClient();
  const user = await getCurrentUser() as { id: string } | null
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get pagination and sort parameters from URL
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '15');
  const sortColumn = searchParams.get('sortColumn') || 'created_at';
  const sortDirection = searchParams.get('sortDirection') || 'desc';
  
  const offset = (page - 1) * limit;

  // Get total count
  const { count, error: countError } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 })
  }

  // Get paginated and sorted data
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .order(sortColumn, { ascending: sortDirection === 'asc' })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data,
    total: count,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit)
  })
}

export async function POST(request: Request) {
  const supabase = createClient();
  const user = await getCurrentUser() as { id: string } | null
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const newTransaction = await request.json();

  const { data, error } = await supabase
    .from('transactions')
    .insert([
      { ...newTransaction, user_id: user.id }
    ])
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data[0])
}
