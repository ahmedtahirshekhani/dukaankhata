// src/app/[locale]/api/orders/route.ts
import {
  getCollection,
  COLLECTIONS,
  toObjectId,
  isValidObjectId,
  setLastUpdated,
  updateUserLastActivity,
} from "@/lib/db/mongodb";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/utils";
import { appendCustomerLedgerEntry } from "@/lib/ledger/customer-ledger";
import { setDateToCurrentTime } from "@/lib/utils";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request: Request) {
  const user = (await getCurrentUser()) as { id: string } | null;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
        { projection: { name: 1, email: 1, phone: 1 } },
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
        overallDiscount: order.overallDiscount || 0,
        shippingCharges: order.shippingCharges || 0,
        customer: customer
          ? {
              name: customer.name,
              email: customer.email,
              phone: customer.phone,
            }
          : null,
        payment: order.payment || null,
      };
    }),
  );

  await updateUserLastActivity();
  return NextResponse.json(ordersWithCustomers);
}

export async function POST(request: Request) {
  const user = (await getCurrentUser()) as { id: string } | null;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    overallDiscount,
    shippingCharges,
    paymentDate,
    payment,
    quotationId,
  } = await request.json();

  try {
    const ordersCollection = await getCollection(COLLECTIONS.ORDERS);
    const transactionsCollection = await getCollection(
      COLLECTIONS.TRANSACTIONS,
    );
    const paymentMethodCollection = await getCollection(
      COLLECTIONS.PAYMENT_METHOD,
    );
    const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);
    const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
    
    const resolvePaymentMethodId = async (
      rawValue: unknown,
    ): Promise<string | null> => {
      if (typeof rawValue !== "string") return null;
      const value = rawValue.trim();
      if (!value) return null;

      const lower = value.toLowerCase();
      if (lower === "cash" || lower === "cheque") {
        return lower;
      }
      if (isValidObjectId(value)) {
        return value;
      }

      const methodDoc = await paymentMethodCollection.findOne(
        {
          user_id: toObjectId(user.id),
          bank_name: { $regex: new RegExp(`^${escapeRegex(value)}$`, "i") },
        },
        { projection: { _id: 1 } },
      );

      return methodDoc?._id
        ? (methodDoc._id as { toString: () => string }).toString()
        : null;
    };
    const resolvedPaymentMethodId = await resolvePaymentMethodId(
      payment?.method ?? paymentMethodId,
    );

    // Build order items array - fetch product names from DB when needed
    const orderItems = await Promise.all(
      products.map(
        async (product: {
          id: string;
          name?: string;
          description?: string;
          quantity: number;
          quantityType?: "prime" | "damaged";
          price: number;
          discount?: number;
          discountType?: "value" | "percentage";
          unit_of_measurement?: string;
        }) => {
          let productName = product.name;
          let productDescription = product.description;
          let productUom = product.unit_of_measurement;
          const productId = isValidObjectId(product.id)
            ? toObjectId(product.id)
            : null;

          if (
            productId &&
            (!productName || !productDescription || !productUom)
          ) {
            const productDoc = await productsCollection.findOne(
              { _id: productId },
              {
                projection: { name: 1, description: 1, unit_of_measurement: 1 },
              },
            );
            if (productDoc) {
              productName = productName || productDoc.name;
              productDescription = productDescription || productDoc.description;
              productUom = productUom || productDoc.unit_of_measurement;
            }
          }

          return {
            product_id: productId,
            name: productName,
            description: productDescription,
            quantity: product.quantity,
            quantityType: product.quantityType || "prime",
            price: product.price,
            discount: product.discount || 0,
            discountType: product.discountType || "value",
            unit_of_measurement: productUom,
          };
        },
      ),
    );

    const now = new Date();
    // Insert the order with embedded items and updated_at
    const orderResult = await ordersCollection.insertOne({
      customer_id: toObjectId(customerId),
      total_amount: total,
      subtotal: typeof subtotal === "number" ? subtotal : total,
      invoice_no: invoiceNo ?? null,
      sale_date: saleDate ? setDateToCurrentTime(saleDate) : setDateToCurrentTime(now),
      due_date: dueDate ? setDateToCurrentTime(dueDate) : null,
      charges: Array.isArray(charges) ? charges : [],
      overallDiscount: typeof overallDiscount === "number" ? overallDiscount : 0,
      shippingCharges: typeof shippingCharges === "number" ? shippingCharges : 0,
      items: orderItems,
      payment: payment
        ? {
            method: resolvedPaymentMethodId,
            paid_amount: payment.paidAmount || 0,
            paid_date: payment.paidDate ? setDateToCurrentTime(payment.paidDate) : null,
            no_payment_at_all: payment.noPaymentAtAll || false,
          }
        : null,
      user_id: toObjectId(user.id),
      status: "completed",
      created_at: now,
      updated_at: now, // ✅ added updated_at
    });

    if (!orderResult.insertedId) {
      throw new Error("Failed to create order");
    }

    const orderId = orderResult.insertedId;

    // Update quotation status if conversion
    if (quotationId && isValidObjectId(quotationId)) {
      const quotationsCollection = await getCollection(COLLECTIONS.QUOTATIONS);
      await setLastUpdated(quotationsCollection, {
        _id: toObjectId(quotationId),
        user_id: toObjectId(user.id)
      }, {
        status: "converted",
        converted_to_invoice_id: orderId
      });
    }

    // Insert the transaction record (optional)
    const paymentInfo = payment || {
      method: null,
      paidAmount: paidAmount,
      paidDate: paymentDate,
      noPaymentAtAll: noPaymentAtAll,
    };

    if (
      !paymentInfo.noPaymentAtAll &&
      (typeof paymentInfo.paidAmount === "number"
        ? paymentInfo.paidAmount > 0
        : true)
    ) {
      const amountToRecord =
        typeof paymentInfo.paidAmount === "number"
          ? paymentInfo.paidAmount
          : total;
      const transactionDoc: any = {
        order_id: orderId,
        amount: amountToRecord,
        user_id: toObjectId(user.id),
        status: "completed",
        category: "selling",
        type: "income",
        description: `Payment for order #${orderId.toString()}`,
        payment_date: paymentInfo.paidDate
          ? setDateToCurrentTime(paymentInfo.paidDate)
          : paymentDate
            ? setDateToCurrentTime(paymentDate)
            : setDateToCurrentTime(now),
        created_at: now,
      };
      if (
        resolvedPaymentMethodId === "cash" ||
        resolvedPaymentMethodId === "cheque"
      ) {
        transactionDoc.payment_method_id = resolvedPaymentMethodId;
      } else {
        transactionDoc.payment_method_id =
          resolvedPaymentMethodId && isValidObjectId(resolvedPaymentMethodId)
            ? toObjectId(resolvedPaymentMethodId)
            : null;
      }
      const transactionResult =
        await transactionsCollection.insertOne(transactionDoc);

      if (!transactionResult.acknowledged) {
        // If there's an error inserting the transaction, delete the order
        await ordersCollection.deleteOne({ _id: orderId });
        throw new Error("Failed to create transaction");
      }
    }

    // Deduct stock from products (only for goods type)
    for (const item of orderItems) {
      if (!item.product_id || !isValidObjectId(item.product_id.toString())) {
        continue;
      }
      const productDoc = await productsCollection.findOne(
        { _id: item.product_id },
        {
          projection: {
            type: 1,
            quantity: 1,
            in_stock: 1,
            damaged_quantity: 1,
          },
        },
      );
      if (!productDoc) continue;

      const productType = (productDoc as { type?: string }).type;
      const isGoods =
        !productType || productType === "goods" || productType === "good";
      if (!isGoods) continue;

      const orderQty = item.quantity || 0;
      if (orderQty <= 0) continue;

      const quantityType =
        (item as { quantityType?: string }).quantityType || "prime";
      const isDamaged = quantityType === "damaged";

      let stockField: string;
      if (isDamaged) {
        stockField = "damaged_quantity";
      } else {
        const productQuantity = (productDoc as { quantity?: number }).quantity;
        const productInStock = (productDoc as { in_stock?: number }).in_stock;
        stockField =
          productQuantity !== undefined && productQuantity !== null
            ? "quantity"
            : productInStock !== undefined && productInStock !== null
              ? "in_stock"
              : "quantity";
      }

      await productsCollection.updateOne(
        { _id: item.product_id },
        { $inc: { [stockField]: -orderQty } },
      );
    }

    // Ledger event: order increases balance (customer owes more)
    await appendCustomerLedgerEntry({
      userId: user.id,
      customerId,
      eventKey: `order_debit:${orderId.toString()}`,
      eventType: "order_debit",
      eventSource: "order",
      eventSourceId: orderId.toString(),
      amountDelta: total,
      effectiveAt: setDateToCurrentTime(saleDate || now),
      metadata: {
        invoice_no: invoiceNo || null,
        total_amount: total,
      },
    });

    // If payment was made at order time, deduct from balance
    const paymentInfo2 = payment || {
      paidAmount: paidAmount,
      noPaymentAtAll: noPaymentAtAll,
    };
    if (
      !paymentInfo2.noPaymentAtAll &&
      typeof paymentInfo2.paidAmount === "number" &&
      paymentInfo2.paidAmount > 0
    ) {
      await appendCustomerLedgerEntry({
        userId: user.id,
        customerId,
        eventKey: `order_payment_credit:${orderId.toString()}`,
        eventType: "order_payment_credit",
        eventSource: "order",
        eventSourceId: orderId.toString(),
        amountDelta: -paymentInfo2.paidAmount,
        effectiveAt: setDateToCurrentTime(
          paymentInfo2.paidDate || paymentDate || saleDate || now
        ),
        metadata: {
          invoice_no: invoiceNo || null,
          paid_amount: paymentInfo2.paidAmount,
        },
      });
    }

    // ✅ Update user's last activity
    const usersCollection = await getCollection(COLLECTIONS.USERS);
    await setLastUpdated(usersCollection, { _id: toObjectId(user.id) });

    // Get customer data
    const customer = await customersCollection.findOne(
      { _id: toObjectId(customerId) },
      { projection: { name: 1 } },
    );

    const orderData = await ordersCollection.findOne({ _id: orderId });

    await updateUserLastActivity();
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
    console.error("Order creation error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}
  