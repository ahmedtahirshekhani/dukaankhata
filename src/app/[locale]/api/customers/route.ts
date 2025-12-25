import { getCollection, COLLECTIONS, toObjectId } from '@/lib/mongodb'
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-utils'

export async function GET(request: Request) {
  const user = await getCurrentUser() as { id: string } | null
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);
  const data = await customersCollection
    .find(
      { user_id: toObjectId(user.id) },
      { projection: { _id: 1, name: 1 } }
    )
    .toArray();

  // Convert _id to id for consistency
  const customers = data.map(customer => ({
    id: customer._id.toString(),
    name: customer.name,
  }));

  return NextResponse.json(customers)
}

export async function POST(request: Request) {
  const user = await getCurrentUser() as { id: string } | null
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const newCustomer = await request.json();

  const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);
  const result = await customersCollection.insertOne({
    ...newCustomer,
    user_id: toObjectId(user.id),
    created_at: new Date(),
    updated_at: new Date(),
  });

  if (!result.insertedId) {
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 })
  }

  const customer = await customersCollection.findOne({ _id: result.insertedId });

  return NextResponse.json({
    ...customer,
    id: customer?._id.toString(),
    _id: undefined,
  })
}
