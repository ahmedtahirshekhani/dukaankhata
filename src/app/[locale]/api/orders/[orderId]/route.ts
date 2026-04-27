// src/app/[locale]/api/orders/[orderId]/route.ts
import { getCollection, COLLECTIONS, toObjectId, isValidObjectId, setLastUpdated } from '@/lib/db/mongodb';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/utils';
import { appendCustomerLedgerEntry } from '@/lib/ledger/customer-ledger';
import { setDateToCurrentTime } from '@/lib/utils';

// Helper to check if product is goods (not service)
function isGoodsProduct(productDoc: any): boolean {
  const type = productDoc?.type;
  return !type || type === 'goods' || type === 'good';
}

// Reverse stock for an old order item
async function reverseStockItem(
  productsCollection: any,
  item: any
): Promise<void> {
  if (!item.product_id) return;
  const productDoc = await productsCollection.findOne({ _id: item.product_id });
  if (!productDoc) return;
  if (!isGoodsProduct(productDoc)) return;

  const qty = item.quantity || 0;
  if (qty <= 0) return;

  const isDamaged = item.quantityType === 'damaged';
  const stockField = isDamaged
    ? 'damaged_quantity'
    : (productDoc.quantity !== undefined ? 'quantity' : 'in_stock');

  await productsCollection.updateOne(
    { _id: item.product_id },
    { $inc: { [stockField]: qty } } // add back to stock
  );
}

// Apply stock deduction for a new order item
async function applyStockItem(
  productsCollection: any,
  item: any
): Promise<void> {
  if (!item.product_id) return;
  const productDoc = await productsCollection.findOne({ _id: item.product_id });
  if (!productDoc) return;
  if (!isGoodsProduct(productDoc)) return;

  const qty = item.quantity || 0;
  if (qty <= 0) return;

  const isDamaged = item.quantityType === 'damaged';
  const stockField = isDamaged
    ? 'damaged_quantity'
    : (productDoc.quantity !== undefined ? 'quantity' : 'in_stock');

  await productsCollection.updateOne(
    { _id: item.product_id },
    { $inc: { [stockField]: -qty } } // deduct from stock
  );
}

export async function PUT(
  request: Request,
  { params }: { params: { orderId: string } }
) {
  const user = (await getCurrentUser()) as { id: string } | null;
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orderId = params.orderId;
  if (!isValidObjectId(orderId)) {
    return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
  }

  const body = await request.json();
  const {
    customerId,
    saleDate,
    dueDate,
    invoiceNo,
    products,
    subtotal,
    charges,
    overallDiscount,
    shippingCharges,
    total,
    payment,
    customerNotes,
  } = body;

  const ordersCollection = await getCollection(COLLECTIONS.ORDERS);
  const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
  const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);
  const transactionsCollection = await getCollection(COLLECTIONS.TRANSACTIONS);

  // 1. Fetch existing order
  const existingOrder = await ordersCollection.findOne({
    _id: toObjectId(orderId),
    user_id: toObjectId(user.id),
  });
  if (!existingOrder) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // 2. Reverse old stock for all old items
  const oldItems = existingOrder.items || [];
  for (const item of oldItems) {
    await reverseStockItem(productsCollection, item);
  }

  // 3. Prepare new items & apply stock deduction
  const newItems = [];
  for (const p of products) {
    let productId = null;
    if (p.id && isValidObjectId(p.id.toString())) {
      productId = toObjectId(p.id);
    }
    const newItem = {
      product_id: productId,
      name: p.name,
      description: p.description,
      quantity: p.quantity,
      quantityType: p.quantityType || 'prime',
      price: p.price,
      discount: p.discount || 0,
      discountType: p.discountType || 'value',
      unit_of_measurement: p.unit_of_measurement,
    };
    newItems.push(newItem);
    await applyStockItem(productsCollection, newItem);
  }

  // 4. Prepare update data (without updated_at, will use setLastUpdated)
  const now = new Date();
  const updateData: any = {
    customer_id: toObjectId(customerId),
    sale_date: saleDate ? setDateToCurrentTime(saleDate) : setDateToCurrentTime(now),
    due_date: dueDate ? setDateToCurrentTime(dueDate) : null,
    invoice_no: invoiceNo || null,
    items: newItems,
    subtotal: subtotal || total,
    charges: charges || [],
    overallDiscount: overallDiscount || 0,
    shippingCharges: shippingCharges || 0,
    total_amount: total,
    customer_notes: customerNotes || null,
  };

  if (payment) {
    updateData.payment = {
      method: payment.method,
      paid_amount: payment.paidAmount || 0,
      paid_date: payment.paidDate ? setDateToCurrentTime(payment.paidDate) : null,
      no_payment_at_all: payment.noPaymentAtAll || false,
    };
  } else {
    updateData.payment = existingOrder.payment; // preserve old payment if not provided
  }

  // ✅ Use setLastUpdated helper for order document
  const filter = { _id: toObjectId(orderId), user_id: toObjectId(user.id) };
  const updateResult = await setLastUpdated(ordersCollection, filter, updateData);

  if (updateResult.matchedCount === 0) {
    // If update fails, reverse the new stock we just applied? Rollback not trivial; return error.
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }

  // Fetch updated document
  const updatedOrder = await ordersCollection.findOne(filter);
  if (!updatedOrder) {
    return NextResponse.json({ error: 'Order not found after update' }, { status: 404 });
  }

  // 5. Update transaction record (delete old, create new if payment exists)
  await transactionsCollection.deleteMany({ order_id: toObjectId(orderId) });
  if (payment && !payment.noPaymentAtAll && payment.paidAmount > 0) {
    await transactionsCollection.insertOne({
      order_id: toObjectId(orderId),
      amount: payment.paidAmount,
      user_id: toObjectId(user.id),
      status: 'completed',
      category: 'selling',
      type: 'income',
      description: `Payment for order #${orderId}`,
      payment_date: payment.paidDate ? setDateToCurrentTime(payment.paidDate) : now,
      payment_method_id: payment.method === 'cash' ? 'cash' : payment.method === 'cheque' ? 'cheque' : null,
      created_at: now,
    });
  }

  // 6. LEDGER ADJUSTMENT
  const oldCustomerId = existingOrder.customer_id.toString();
  const newCustomerId = customerId;
  const oldTotal = Number(existingOrder.total_amount ?? 0);
  const oldPaid = Number(existingOrder.payment?.paid_amount ?? 0);
  const newTotal = Number(total);
  const newPaid = payment?.paidAmount || 0;
  const oldNet = oldTotal - oldPaid;
  const newNet = newTotal - newPaid;

  // Reverse old net from old customer
  if (oldCustomerId && oldNet !== 0) {
    await appendCustomerLedgerEntry({
      userId: user.id,
      customerId: oldCustomerId,
      eventKey: `order_update_reverse:${orderId}:${oldCustomerId}:${Date.now()}`,
      eventType: 'manual_adjustment',
      eventSource: 'order',
      eventSourceId: orderId,
      amountDelta: -oldNet,
      effectiveAt: now,
      metadata: { reason: 'order_update_reverse', oldTotal, oldPaid },
    });
  }

  // Apply new net to new customer (could be same or different)
  if (newCustomerId && newNet !== 0) {
    await appendCustomerLedgerEntry({
      userId: user.id,
      customerId: newCustomerId,
      eventKey: `order_update_apply:${orderId}:${newCustomerId}:${Date.now()}`,
      eventType: 'manual_adjustment',
      eventSource: 'order',
      eventSourceId: orderId,
      amountDelta: newNet,
      effectiveAt: now,
      metadata: { reason: 'order_update_apply', newTotal, newPaid },
    });
  }

  // ✅ Update user's last activity
  const usersCollection = await getCollection(COLLECTIONS.USERS);
  await setLastUpdated(usersCollection, { _id: toObjectId(user.id) });

  // 7. Fetch updated customer data for response
  const customer = await customersCollection.findOne(
    { _id: toObjectId(newCustomerId) },
    { projection: { name: 1, email: 1, phone: 1 } }
  );

  return NextResponse.json({
    id: updatedOrder._id.toString(),
    customer_id: updatedOrder.customer_id.toString(),
    total_amount: updatedOrder.total_amount,
    invoice_no: updatedOrder.invoice_no,
    sale_date: updatedOrder.sale_date,
    due_date: updatedOrder.due_date,
    items: updatedOrder.items,
    charges: updatedOrder.charges,
    overallDiscount: updatedOrder.overallDiscount,
    shippingCharges: updatedOrder.shippingCharges,
    payment: updatedOrder.payment,
    customer_notes: updatedOrder.customer_notes,
    customer: customer ? { name: customer.name, email: customer.email, phone: customer.phone } : null,
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: { orderId: string } }
) {
  const user = (await getCurrentUser()) as { id: string } | null;
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orderId = params.orderId;
  if (!isValidObjectId(orderId)) {
    return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
  }

  const ordersCollection = await getCollection(COLLECTIONS.ORDERS);
  const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
  const transactionsCollection = await getCollection(COLLECTIONS.TRANSACTIONS);

  const order = await ordersCollection.findOne({
    _id: toObjectId(orderId),
    user_id: toObjectId(user.id),
  });
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Reverse stock for all items before deletion
  const items = order.items || [];
  for (const item of items) {
    if (!item.product_id) continue;
    const productDoc = await productsCollection.findOne({ _id: item.product_id });
    if (productDoc && isGoodsProduct(productDoc)) {
      const qty = item.quantity || 0;
      if (qty > 0) {
        const isDamaged = item.quantityType === 'damaged';
        const stockField = isDamaged
          ? 'damaged_quantity'
          : (productDoc.quantity !== undefined ? 'quantity' : 'in_stock');
        await productsCollection.updateOne(
          { _id: item.product_id },
          { $inc: { [stockField]: qty } }
        );
      }
    }
  }

  // Delete order and related transactions
  await ordersCollection.deleteOne({ _id: toObjectId(orderId) });
  await transactionsCollection.deleteMany({ order_id: toObjectId(orderId) });

  // Reverse ledger entry: remove the net outstanding
  const customerId = order.customer_id.toString();
  const totalAmount = Number(order.total_amount ?? 0);
  const paidAmount = Number(order.payment?.paid_amount ?? 0);
  const netOutstanding = totalAmount - paidAmount;
  if (customerId && netOutstanding !== 0) {
    await appendCustomerLedgerEntry({
      userId: user.id,
      customerId: customerId,
      eventKey: `order_delete_reverse:${orderId}:${customerId}:${Date.now()}`,
      eventType: 'manual_adjustment',
      eventSource: 'order',
      eventSourceId: orderId,
      amountDelta: -netOutstanding,
      effectiveAt: new Date(),
      metadata: { reason: 'order_deleted', totalAmount, paidAmount },
    });
  }

  // ✅ Update user's last activity after deletion
  const usersCollection = await getCollection(COLLECTIONS.USERS);
  await setLastUpdated(usersCollection, { _id: toObjectId(user.id) });

  return NextResponse.json({ message: 'Order deleted successfully' });
}