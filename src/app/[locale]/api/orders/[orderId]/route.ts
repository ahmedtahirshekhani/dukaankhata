import { getCollection, COLLECTIONS, toObjectId, isValidObjectId } from '@/lib/db/mongodb'
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/utils'
import { appendCustomerLedgerEntry } from '@/lib/ledger/customer-ledger'

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
  const existingOrder = await ordersCollection.findOne({
    _id: toObjectId(orderId),
    user_id: toObjectId(user.id),
  });

  if (!existingOrder) {
    return NextResponse.json({ error: 'Order not found or not authorized' }, { status: 404 })
  }

  const updatedAt = new Date();

  const result = await ordersCollection.findOneAndUpdate(
    {
      _id: toObjectId(orderId),
      user_id: toObjectId(user.id)
    },
    {
      $set: {
        ...updatedOrder,
        user_id: toObjectId(user.id),
        updated_at: updatedAt,
      }
    },
    { returnDocument: 'after' }
  );

  if (!result) {
    return NextResponse.json({ error: 'Order not found or not authorized' }, { status: 404 })
  }

  const oldTotal = Number(existingOrder.total_amount ?? 0);
  const oldPaid = Number(existingOrder.payment?.paid_amount ?? 0);
  const oldNet = oldTotal - oldPaid;

  const newTotal = Number(result.total_amount ?? 0);
  const newPaid = Number(result.payment?.paid_amount ?? 0);
  const newNet = newTotal - newPaid;

  const oldCustomerId = existingOrder.customer_id?.toString();
  const newCustomerId = result.customer_id?.toString();

  if (oldCustomerId && isValidObjectId(oldCustomerId) && oldNet !== 0) {
    await appendCustomerLedgerEntry({
      userId: user.id,
      customerId: oldCustomerId,
      eventKey: `order_update_reverse:${orderId}:${oldCustomerId}:${oldNet}`,
      eventType: 'manual_adjustment',
      eventSource: 'order',
      eventSourceId: orderId,
      amountDelta: -oldNet,
      effectiveAt: updatedAt,
      metadata: { reason: 'order_update_reverse' },
    });
  }

  if (newCustomerId && isValidObjectId(newCustomerId) && newNet !== 0) {
    await appendCustomerLedgerEntry({
      userId: user.id,
      customerId: newCustomerId,
      eventKey: `order_update_apply:${orderId}:${newCustomerId}:${newNet}`,
      eventType: 'manual_adjustment',
      eventSource: 'order',
      eventSourceId: orderId,
      amountDelta: newNet,
      effectiveAt: updatedAt,
      metadata: { reason: 'order_update_apply' },
    });
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
  const existingOrder = await ordersCollection.findOne({
    _id: toObjectId(orderId),
    user_id: toObjectId(user.id),
  });

  if (!existingOrder) {
    return NextResponse.json({ error: 'Order not found or not authorized' }, { status: 404 })
  }

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

  const customerId = existingOrder.customer_id?.toString();
  const total = Number(existingOrder.total_amount ?? 0);
  const paid = Number(existingOrder.payment?.paid_amount ?? 0);
  const netOutstanding = total - paid;

  if (customerId && isValidObjectId(customerId) && netOutstanding !== 0) {
    await appendCustomerLedgerEntry({
      userId: user.id,
      customerId,
      eventKey: `order_delete_reverse:${orderId}:${customerId}:${netOutstanding}`,
      eventType: 'manual_adjustment',
      eventSource: 'order',
      eventSourceId: orderId,
      amountDelta: -netOutstanding,
      effectiveAt: new Date(),
      metadata: { reason: 'order_delete_reverse' },
    });
  }

  return NextResponse.json({ message: 'Order and related items deleted successfully' })
}
