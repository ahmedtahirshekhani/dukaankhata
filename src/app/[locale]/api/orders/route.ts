// // src/app/[locale]/api/orders/route.ts
// import {
//   getCollection,
//   COLLECTIONS,
//   toObjectId,
//   isValidObjectId,
// } from "@/lib/db/mongodb";
// import { NextResponse } from "next/server";
// import { getCurrentUser } from "@/lib/auth/utils";
// import { appendCustomerLedgerEntry } from "@/lib/ledger/customer-ledger";
// import { setDateToCurrentTime } from "@/lib/utils";

// function escapeRegex(value: string): string {
//   return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// }

// export async function GET(request: Request) {
//   const user = (await getCurrentUser()) as { id: string } | null;

//   if (!user) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }

//   const ordersCollection = await getCollection(COLLECTIONS.ORDERS);
//   const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);

//   // Get orders for the user
//   const orders = await ordersCollection
//     .find({ user_id: toObjectId(user.id) })
//     .sort({ created_at: -1 })
//     .toArray();

//   // Get customer data for each order
//   const ordersWithCustomers = await Promise.all(
//     orders.map(async (order) => {
//       const customer = await customersCollection.findOne(
//         { _id: order.customer_id },
//         { projection: { name: 1, email: 1, phone: 1 } },
//       );

//       return {
//         id: order._id.toString(),
//         customer_id: order.customer_id.toString(),
//         total_amount: order.total_amount,
//         subtotal: order.subtotal || order.total_amount,
//         user_id: order.user_id.toString(),
//         status: order.status,
//         created_at: order.created_at,
//         sale_date: order.sale_date || order.created_at,
//         due_date: order.due_date || null,
//         invoice_no: order.invoice_no || null,
//         items: order.items || [],
//         charges: order.charges || [],
//         overallDiscount: order.overallDiscount || 0,
//         shippingCharges: order.shippingCharges || 0,
//         customer: customer
//           ? {
//               name: customer.name,
//               email: customer.email,
//               phone: customer.phone,
//             }
//           : null,
//         payment: order.payment || null,
//       };
//     }),
//   );

//   return NextResponse.json(ordersWithCustomers);
// }

// export async function POST(request: Request) {
//   const user = (await getCurrentUser()) as { id: string } | null;

//   if (!user) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }

//   const {
//     customerId,
//     paymentMethodId,
//     products,
//     total,
//     noPaymentAtAll,
//     paidAmount,
//     invoiceNo,
//     saleDate,
//     dueDate,
//     subtotal,
//     charges,
//     overallDiscount,
//     shippingCharges,
//     paymentDate,
//     payment,
//   } = await request.json();

//   try {
//     const ordersCollection = await getCollection(COLLECTIONS.ORDERS);
//     const transactionsCollection = await getCollection(
//       COLLECTIONS.TRANSACTIONS,
//     );
//     const paymentMethodCollection = await getCollection(
//       COLLECTIONS.PAYMENT_METHOD,
//     );
//     const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);
//     const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
//     const resolvePaymentMethodId = async (
//       rawValue: unknown,
//     ): Promise<string | null> => {
//       if (typeof rawValue !== "string") return null;
//       const value = rawValue.trim();
//       if (!value) return null;

//       const lower = value.toLowerCase();
//       if (lower === "cash" || lower === "cheque") {
//         return lower;
//       }
//       if (isValidObjectId(value)) {
//         return value;
//       }

//       const methodDoc = await paymentMethodCollection.findOne(
//         {
//           user_id: toObjectId(user.id),
//           bank_name: { $regex: new RegExp(`^${escapeRegex(value)}$`, "i") },
//         },
//         { projection: { _id: 1 } },
//       );

//       return methodDoc?._id
//         ? (methodDoc._id as { toString: () => string }).toString()
//         : null;
//     };
//     const resolvedPaymentMethodId = await resolvePaymentMethodId(
//       payment?.method ?? paymentMethodId,
//     );

//     // Build order items array - fetch product names from DB when needed
//     const orderItems = await Promise.all(
//       products.map(
//         async (product: {
//           id: string;
//           name?: string;
//           description?: string;
//           quantity: number;
//           quantityType?: "prime" | "damaged";
//           price: number;
//           discount?: number;
//           discountType?: "value" | "percentage";
//           unit_of_measurement?: string;
//         }) => {
//           let productName = product.name;
//           let productDescription = product.description;
//           let productUom = product.unit_of_measurement;
//           const productId = isValidObjectId(product.id)
//             ? toObjectId(product.id)
//             : null;

//           // If product_id is valid but details are missing, fetch from products collection
//           if (
//             productId &&
//             (!productName || !productDescription || !productUom)
//           ) {
//             const productDoc = await productsCollection.findOne(
//               { _id: productId },
//               {
//                 projection: { name: 1, description: 1, unit_of_measurement: 1 },
//               },
//             );
//             if (productDoc) {
//               productName = productName || productDoc.name;
//               productDescription = productDescription || productDoc.description;
//               productUom = productUom || productDoc.unit_of_measurement;
//             }
//           }

//           return {
//             product_id: productId,
//             name: productName,
//             description: productDescription,
//             quantity: product.quantity,
//             quantityType: product.quantityType || "prime",
//             price: product.price,
//             discount: product.discount || 0,
//             discountType: product.discountType || "value",
//             unit_of_measurement: productUom,
//           };
//         },
//       ),
//     );

//     // Insert the order with embedded items
//     const orderResult = await ordersCollection.insertOne({
//       customer_id: toObjectId(customerId),
//       total_amount: total,
//       subtotal: typeof subtotal === "number" ? subtotal : total,
//       invoice_no: invoiceNo ?? null,
//       sale_date: saleDate ? setDateToCurrentTime(saleDate) : setDateToCurrentTime(new Date()),
//       due_date: dueDate ? setDateToCurrentTime(dueDate) : null,
//       charges: Array.isArray(charges) ? charges : [],
//       overallDiscount:
//         typeof overallDiscount === "number" ? overallDiscount : 0,
//       shippingCharges:
//         typeof shippingCharges === "number" ? shippingCharges : 0,
//       items: orderItems,
//       payment: payment
//         ? {
//             method: resolvedPaymentMethodId,
//             paid_amount: payment.paidAmount || 0,
//             paid_date: payment.paidDate ? setDateToCurrentTime(payment.paidDate) : null,
//             no_payment_at_all: payment.noPaymentAtAll || false,
//           }
//         : null,
//       user_id: toObjectId(user.id),
//       status: "completed",
//       created_at: new Date(),
//     });

//     if (!orderResult.insertedId) {
//       throw new Error("Failed to create order");
//     }

//     const orderId = orderResult.insertedId;

//     // Insert the transaction record (optional)
//     // Use payment object if available, otherwise fall back to legacy fields
//     const paymentInfo = payment || {
//       method: null,
//       paidAmount: paidAmount,
//       paidDate: paymentDate,
//       noPaymentAtAll: noPaymentAtAll,
//     };

//     if (
//       !paymentInfo.noPaymentAtAll &&
//       (typeof paymentInfo.paidAmount === "number"
//         ? paymentInfo.paidAmount > 0
//         : true)
//     ) {
//       const amountToRecord =
//         typeof paymentInfo.paidAmount === "number"
//           ? paymentInfo.paidAmount
//           : total;
//       const transactionDoc: any = {
//         order_id: orderId,
//         amount: amountToRecord,
//         user_id: toObjectId(user.id),
//         status: "completed",
//         category: "selling",
//         type: "income",
//         description: `Payment for order #${orderId.toString()}`,
//         payment_date: paymentInfo.paidDate
//           ? setDateToCurrentTime(paymentInfo.paidDate)
//           : paymentDate
//             ? setDateToCurrentTime(paymentDate)
//             : setDateToCurrentTime(new Date()),
//         created_at: new Date(),
//       };
//       if (
//         resolvedPaymentMethodId === "cash" ||
//         resolvedPaymentMethodId === "cheque"
//       ) {
//         transactionDoc.payment_method_id = resolvedPaymentMethodId;
//       } else {
//         transactionDoc.payment_method_id =
//           resolvedPaymentMethodId && isValidObjectId(resolvedPaymentMethodId)
//             ? toObjectId(resolvedPaymentMethodId)
//             : null;
//       }
//       const transactionResult =
//         await transactionsCollection.insertOne(transactionDoc);

//       if (!transactionResult.acknowledged) {
//         // If there's an error inserting the transaction, delete the order
//         await ordersCollection.deleteOne({ _id: orderId });
//         throw new Error("Failed to create transaction");
//       }
//     }

//     // Deduct stock from products (only for goods type)
//     for (const item of orderItems) {
//       if (!item.product_id || !isValidObjectId(item.product_id.toString())) {
//         continue;
//       }
//       const productDoc = await productsCollection.findOne(
//         { _id: item.product_id },
//         {
//           projection: {
//             type: 1,
//             quantity: 1,
//             in_stock: 1,
//             damaged_quantity: 1,
//           },
//         },
//       );
//       if (!productDoc) continue;

//       const productType = (productDoc as { type?: string }).type;
//       const isGoods =
//         !productType || productType === "goods" || productType === "good";
//       if (!isGoods) continue;

//       const orderQty = item.quantity || 0;
//       if (orderQty <= 0) continue;

//       const quantityType =
//         (item as { quantityType?: string }).quantityType || "prime";
//       const isDamaged = quantityType === "damaged";

//       let stockField: string;
//       if (isDamaged) {
//         stockField = "damaged_quantity";
//       } else {
//         const productQuantity = (productDoc as { quantity?: number }).quantity;
//         const productInStock = (productDoc as { in_stock?: number }).in_stock;
//         stockField =
//           productQuantity !== undefined && productQuantity !== null
//             ? "quantity"
//             : productInStock !== undefined && productInStock !== null
//               ? "in_stock"
//               : "quantity";
//       }

//       await productsCollection.updateOne(
//         { _id: item.product_id },
//         { $inc: { [stockField]: -orderQty } },
//       );
//     }

//     // Ledger event: order increases balance (customer owes more)
//     await appendCustomerLedgerEntry({
//       userId: user.id,
//       customerId,
//       eventKey: `order_debit:${orderId.toString()}`,
//       eventType: "order_debit",
//       eventSource: "order",
//       eventSourceId: orderId.toString(),
//       amountDelta: total,
//       effectiveAt: setDateToCurrentTime(saleDate || new Date()),
//       metadata: {
//         invoice_no: invoiceNo || null,
//         total_amount: total,
//       },
//     });

//     // If payment was made at order time, deduct from balance
//     const paymentInfo2 = payment || {
//       paidAmount: paidAmount,
//       noPaymentAtAll: noPaymentAtAll,
//     };
//     if (
//       !paymentInfo2.noPaymentAtAll &&
//       typeof paymentInfo2.paidAmount === "number" &&
//       paymentInfo2.paidAmount > 0
//     ) {
//       await appendCustomerLedgerEntry({
//         userId: user.id,
//         customerId,
//         eventKey: `order_payment_credit:${orderId.toString()}`,
//         eventType: "order_payment_credit",
//         eventSource: "order",
//         eventSourceId: orderId.toString(),
//         amountDelta: -paymentInfo2.paidAmount,
//         effectiveAt: setDateToCurrentTime(
//           paymentInfo2.paidDate || paymentDate || saleDate || new Date()
//         ),
//         metadata: {
//           invoice_no: invoiceNo || null,
//           paid_amount: paymentInfo2.paidAmount,
//         },
//       });
//     }

//     // Get customer data
//     const customer = await customersCollection.findOne(
//       { _id: toObjectId(customerId) },
//       { projection: { name: 1 } },
//     );

//     const orderData = await ordersCollection.findOne({ _id: orderId });

//     return NextResponse.json({
//       id: orderData?._id.toString(),
//       customer_id: orderData?.customer_id.toString(),
//       total_amount: orderData?.total_amount,
//       user_id: orderData?.user_id.toString(),
//       status: orderData?.status,
//       created_at: orderData?.created_at,
//       customer: customer ? { name: customer.name } : null,
//     });
//   } catch (error) {
//     return NextResponse.json(
//       { error: (error as Error).message },
//       { status: 500 },
//     );
//   }
// }




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