import { getCollection, COLLECTIONS, toObjectId } from '@/lib/mongodb'
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-utils'

export async function GET(request: Request) {
  const user = await getCurrentUser() as { id: string } | null
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ordersCollection = await getCollection(COLLECTIONS.ORDERS);
  const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);
  
  // Get orders for the user
  const orders = await ordersCollection
    .find({ user_id: toObjectId(user.id) })
    .sort({ created_at: -1 })
    .toArray();

  // Get customer data for each order
  const ordersWithCustomers = await Promise.all(
    orders.map(async (order) => {
      const customer = await customersCollection.findOne(
        { _id: order.customer_id },
        { projection: { name: 1 } }
      );
      
      return {
        id: order._id.toString(),
        customer_id: order.customer_id.toString(),
        total_amount: order.total_amount,
        user_id: order.user_id.toString(),
        status: order.status,
        created_at: order.created_at,
        customer: customer ? { name: customer.name } : null,
      };
    })
  );

  return NextResponse.json(ordersWithCustomers)
}

export async function POST(request: Request) {
  const user = await getCurrentUser() as { id: string } | null
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { customerId, paymentMethodId, products, total } = await request.json();

  try {
    const ordersCollection = await getCollection(COLLECTIONS.ORDERS);
    const orderItemsCollection = await getCollection(COLLECTIONS.ORDER_ITEMS);
    const transactionsCollection = await getCollection(COLLECTIONS.TRANSACTIONS);
    const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);
    
    // Insert the order
    const orderResult = await ordersCollection.insertOne({
      customer_id: toObjectId(customerId),
      total_amount: total,
      user_id: toObjectId(user.id),
      status: 'completed',
      created_at: new Date(),
    });

    if (!orderResult.insertedId) {
      throw new Error('Failed to create order');
    }

    const orderId = orderResult.insertedId;

    // Insert the order items
    const orderItems = products.map((product: { id: string, quantity: number, price: number }) => ({
      order_id: orderId,
      product_id: toObjectId(product.id),
      quantity: product.quantity,
      price: product.price
    }));

    const itemsResult = await orderItemsCollection.insertMany(orderItems);

    if (!itemsResult.acknowledged) {
      // If there's an error inserting order items, delete the order
      await ordersCollection.deleteOne({ _id: orderId });
      throw new Error('Failed to create order items');
    }

    // Insert the transaction record
    const transactionResult = await transactionsCollection.insertOne({
      order_id: orderId,
      payment_method_id: toObjectId(paymentMethodId),
      amount: total,
      user_id: toObjectId(user.id),
      status: 'completed',
      category: 'selling',
      type: 'income',
      description: `Payment for order #${orderId.toString()}`,
      created_at: new Date(),
    });

    if (!transactionResult.acknowledged) {
      // If there's an error inserting the transaction, delete the order and order items
      await ordersCollection.deleteOne({ _id: orderId });
      await orderItemsCollection.deleteMany({ order_id: orderId });
      throw new Error('Failed to create transaction');
    }

    // Get customer data
    const customer = await customersCollection.findOne(
      { _id: toObjectId(customerId) },
      { projection: { name: 1 } }
    );

    const orderData = await ordersCollection.findOne({ _id: orderId });

    return NextResponse.json({
      id: orderData?._id.toString(),
      customer_id: orderData?.customer_id.toString(),
      total_amount: orderData?.total_amount,
      user_id: orderData?.user_id.toString(),
      status: orderData?.status,
      created_at: orderData?.created_at,
      customer: customer ? { name: customer.name } : null,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
