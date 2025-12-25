import { getCollection, COLLECTIONS, toObjectId, isValidObjectId } from '@/lib/mongodb'
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-utils'

export async function PUT(
  request: Request,
  { params }: { params: { orderId: string } }
) {
  const user = await getCurrentUser() as { id: string } | null
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const updatedOrder = await request.json();
  const orderId = params.orderId;

  if (!isValidObjectId(orderId)) {
    return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })
  }

  const ordersCollection = await getCollection(COLLECTIONS.ORDERS);
  const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);

  const result = await ordersCollection.findOneAndUpdate(
    {
      _id: toObjectId(orderId),
      user_id: toObjectId(user.id)
    },
    {
      $set: {
        ...updatedOrder,
        user_id: toObjectId(user.id)
      }
    },
    { returnDocument: 'after' }
  );

  if (!result) {
    return NextResponse.json({ error: 'Order not found or not authorized' }, { status: 404 })
  }

  // Get customer data
  const customer = await customersCollection.findOne(
    { _id: result.customer_id },
    { projection: { name: 1 } }
  );

  return NextResponse.json({
    id: result._id.toString(),
    customer_id: result.customer_id.toString(),
    total_amount: result.total_amount,
    user_id: result.user_id.toString(),
    status: result.status,
    created_at: result.created_at,
    customer: customer ? { name: customer.name } : null,
  })
}

export async function DELETE(
  request: Request,
  { params }: { params: { orderId: string } }
) {
  const user = await getCurrentUser() as { id: string } | null
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orderId = params.orderId;

  if (!isValidObjectId(orderId)) {
    return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })
  }

  const ordersCollection = await getCollection(COLLECTIONS.ORDERS);
  const orderItemsCollection = await getCollection(COLLECTIONS.ORDER_ITEMS);

  // First, delete related order_items
  await orderItemsCollection.deleteMany({ order_id: toObjectId(orderId) });

  // Then, delete the order
  const result = await ordersCollection.deleteOne({
    _id: toObjectId(orderId),
    user_id: toObjectId(user.id)
  });

  if (result.deletedCount === 0) {
    return NextResponse.json({ error: 'Order not found or not authorized' }, { status: 404 })
  }

  return NextResponse.json({ message: 'Order and related items deleted successfully' })
}
