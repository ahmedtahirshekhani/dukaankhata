import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth-utils'
import { NextResponse } from 'next/server'

export async function PUT(
  request: Request,
  { params }: { params: { customerId: string } }
) {
  const supabase = createClient();
  // Fetch the authenticated user via NextAuth helper
  const user = await getCurrentUser() as { id: string } | null
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const updatedCustomer = await request.json();
  const customerId = params.customerId;

  const { data, error } = await supabase
    .from('customers')
    .update({
      ...updatedCustomer,
      user_id: user.id,
      // Update timestamp in UTC
      updated_at: new Date().toISOString(),
    })
    .eq('id', customerId)
    .eq('user_id', user.id)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (data.length === 0) {
    return NextResponse.json({ error: 'Customer not found or not authorized' }, { status: 404 })
  }

  return NextResponse.json(data[0])
}

export async function DELETE(
  request: Request,
  { params }: { params: { customerId: string } }
) {
  const supabase = createClient();
  // Fetch the authenticated user via NextAuth helper
  const user = await getCurrentUser() as { id: string } | null
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const customerId = params.customerId;

  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', customerId)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: 'Customer deleted successfully' })
}
