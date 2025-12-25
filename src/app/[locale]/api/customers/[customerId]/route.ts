import { getCollection, COLLECTIONS, toObjectId, isValidObjectId } from '@/lib/mongodb'
import { getCurrentUser } from '@/lib/auth-utils'
import { NextResponse } from 'next/server'

export async function PUT(
  request: Request,
  { params }: { params: { customerId: string } }
) {
  // Fetch the authenticated user via NextAuth helper
  const user = await getCurrentUser() as { id: string } | null
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const updatedCustomer = await request.json();
  const customerId = params.customerId;

  if (!isValidObjectId(customerId)) {
    return NextResponse.json({ error: 'Invalid customer ID' }, { status: 400 })
  }

  const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);
  const result = await customersCollection.findOneAndUpdate(
    {
      _id: toObjectId(customerId),
      user_id: toObjectId(user.id)
    },
    {
      $set: {
        ...updatedCustomer,
        user_id: toObjectId(user.id),
        updated_at: new Date(),
      }
    },
    { returnDocument: 'after' }
  );

  if (!result) {
    return NextResponse.json({ error: 'Customer not found or not authorized' }, { status: 404 })
  }

  return NextResponse.json({
    ...result,
    id: result._id.toString(),
    _id: undefined,
  })
}

export async function DELETE(
  request: Request,
  { params }: { params: { customerId: string } }
) {
  // Fetch the authenticated user via NextAuth helper
  const user = await getCurrentUser() as { id: string } | null
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const customerId = params.customerId;

  if (!isValidObjectId(customerId)) {
    return NextResponse.json({ error: 'Invalid customer ID' }, { status: 400 })
  }

  const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);
  const result = await customersCollection.deleteOne({
    _id: toObjectId(customerId),
    user_id: toObjectId(user.id)
  });

  if (result.deletedCount === 0) {
    return NextResponse.json({ error: 'Customer not found or not authorized' }, { status: 404 })
  }

  return NextResponse.json({ message: 'Customer deleted successfully' })
}
