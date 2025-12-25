import { getCollection, COLLECTIONS, toObjectId, isValidObjectId } from '@/lib/mongodb'
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
        subtotal: order.subtotal || order.total_amount,
        user_id: order.user_id.toString(),
        status: order.status,
        created_at: order.created_at,
        sale_date: order.sale_date || order.created_at,
        due_date: order.due_date || null,
        invoice_no: order.invoice_no || null,
        items: order.items || [],
        charges: order.charges || [],
        customer: customer ? { name: customer.name } : null,
        payment: order.payment || null,
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

  const {
    customerId,
    paymentMethodId,
    products,
    total,
    noPaymentAtAll,
    paidAmount,
    invoiceNo,
    saleDate,
    dueDate,
    subtotal,
    charges,
    paymentDate,
    payment,
  } = await request.json();

  try {
    const ordersCollection = await getCollection(COLLECTIONS.ORDERS);
    const transactionsCollection = await getCollection(COLLECTIONS.TRANSACTIONS);
    const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);
    const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
    
    // Build order items array - fetch product names from DB when needed
    const orderItems = await Promise.all(
      products.map(async (product: { id: string, name?: string, quantity: number, price: number }) => {
        let productName = product.name;
        const productId = isValidObjectId(product.id) ? toObjectId(product.id) : null;
        
        // If product_id is valid but name is missing, fetch from products collection
        if (productId && !productName) {
          const productDoc = await productsCollection.findOne(
            { _id: productId },
            { projection: { name: 1 } }
          );
          productName = productDoc?.name;
        }
        
        return {
          product_id: productId,
          name: productName,
          quantity: product.quantity,
          price: product.price,
        };
      })
    );

    // Insert the order with embedded items
    const orderResult = await ordersCollection.insertOne({
      customer_id: toObjectId(customerId),
      total_amount: total,
      subtotal: typeof subtotal === 'number' ? subtotal : total,
      invoice_no: invoiceNo ?? null,
      sale_date: saleDate ? new Date(saleDate) : new Date(),
      due_date: dueDate ? new Date(dueDate) : null,
      charges: Array.isArray(charges) ? charges : [],
      items: orderItems,
      payment: payment ? {
        method: payment.method || null,
        paid_amount: payment.paidAmount || 0,
        paid_date: payment.paidDate ? new Date(payment.paidDate) : null,
        no_payment_at_all: payment.noPaymentAtAll || false,
      } : null,
      user_id: toObjectId(user.id),
      status: 'completed',
      created_at: new Date(),
    });

    if (!orderResult.insertedId) {
      throw new Error('Failed to create order');
    }

    const orderId = orderResult.insertedId;

    // Insert the transaction record (optional)
    // Use payment object if available, otherwise fall back to legacy fields
    const paymentInfo = payment || { 
      method: null, 
      paidAmount: paidAmount, 
      paidDate: paymentDate, 
      noPaymentAtAll: noPaymentAtAll 
    };
    
    if (!paymentInfo.noPaymentAtAll && (typeof paymentInfo.paidAmount === 'number' ? paymentInfo.paidAmount > 0 : true)) {
      const amountToRecord = typeof paymentInfo.paidAmount === 'number' ? paymentInfo.paidAmount : total;
      const transactionDoc: any = {
        order_id: orderId,
        amount: amountToRecord,
        user_id: toObjectId(user.id),
        status: 'completed',
        category: 'selling',
        type: 'income',
        description: `Payment for order #${orderId.toString()}`,
        payment_date: paymentInfo.paidDate ? new Date(paymentInfo.paidDate) : (paymentDate ? new Date(paymentDate) : new Date()),
        created_at: new Date(),
      };
      transactionDoc.payment_method_id = (paymentMethodId && isValidObjectId(paymentMethodId)) ? toObjectId(paymentMethodId) : null;
      const transactionResult = await transactionsCollection.insertOne(transactionDoc);

      if (!transactionResult.acknowledged) {
        // If there's an error inserting the transaction, delete the order
        await ordersCollection.deleteOne({ _id: orderId });
        throw new Error('Failed to create transaction');
      }
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
