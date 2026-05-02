// src/app/[locale]/api/quotations/[id]/convert/route.ts
import {
  getCollection,
  COLLECTIONS,
  toObjectId,
  isValidObjectId,
  setLastUpdated,
} from "@/lib/db/mongodb";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/utils";
import { appendCustomerLedgerEntry } from "@/lib/ledger/customer-ledger";

export async function POST(
  request: Request,
  { params }: { params: { id: string; locale: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid quotation ID" }, { status: 400 });
  }

  try {
    const quotationsCollection = await getCollection(COLLECTIONS.QUOTATIONS);
    const ordersCollection = await getCollection(COLLECTIONS.ORDERS);
    const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
    const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);

    const quotation = await quotationsCollection.findOne({
      _id: toObjectId(id),
      user_id: toObjectId(user.id),
    });

    if (!quotation) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    }

    if (quotation.status === "converted") {
      return NextResponse.json({ error: "Quotation already converted" }, { status: 400 });
    }

    const now = new Date();
    // Invoice number format: inv- + quotation_no
    const invoiceNo = `inv-${quotation.quotation_no || id.slice(-6)}`;

    // 1. Prepare Order Items
    const orderItems = quotation.items.map((item: any) => ({
      product_id: item.product_id ? toObjectId(item.product_id) : null,
      name: item.product_name || item.name,
      description: item.product_description || item.description || "",
      quantity: item.quantity,
      quantityType: "prime",
      price: item.cost_price || item.price || 0,
      discount: item.discount || 0,
      discountType: item.discount_type || "value",
      unit_of_measurement: item.uom || item.unit_of_measurement || "",
    }));

    // 2. Insert Order
    const orderDoc: any = {
      customer_id: toObjectId(quotation.party_id),
      total_amount: quotation.total_amount,
      subtotal: quotation.total_amount,
      invoice_no: invoiceNo,
      sale_date: now,
      due_date: null,
      charges: [],
      overallDiscount: 0,
      shippingCharges: 0,
      items: orderItems,
      payment: {
        method: null,
        paid_amount: 0,
        paid_date: null,
        no_payment_at_all: true,
      },
      user_id: toObjectId(user.id),
      status: "completed",
      created_at: now,
      updated_at: now,
      quotation_id: toObjectId(id),
    };

    const orderResult = await ordersCollection.insertOne(orderDoc);
    const orderId = orderResult.insertedId;

    if (!orderId) {
      throw new Error("Failed to create order");
    }

    // 3. Deduct Stock from Products (only for goods type)
    for (const item of orderItems) {
      if (!item.product_id) continue;
      
      const productDoc = await productsCollection.findOne({ _id: item.product_id });
      if (!productDoc) continue;

      const isGoods = !productDoc.type || productDoc.type === "goods" || productDoc.type === "good";
      if (!isGoods) continue;

      const orderQty = item.quantity;
      const quantityType = item.quantityType || "prime";
      const isDamaged = quantityType === "damaged";

      let stockField: string;
      if (isDamaged) {
        stockField = "damaged_quantity";
      } else {
        stockField = productDoc.quantity !== undefined && productDoc.quantity !== null
          ? "quantity"
          : productDoc.in_stock !== undefined && productDoc.in_stock !== null
            ? "in_stock"
            : "quantity";
      }

      await productsCollection.updateOne(
        { _id: item.product_id },
        { 
          $inc: { [stockField]: -orderQty },
          $set: { updated_at: now } 
        }
      );
    }

    // 4. Update Customer Ledger (Record the sale)
    await appendCustomerLedgerEntry({
      userId: user.id,
      customerId: quotation.party_id,
      eventKey: `order_debit:${orderId.toString()}`,
      eventType: "order_debit",
      eventSource: "order",
      eventSourceId: orderId.toString(),
      amountDelta: quotation.total_amount,
      effectiveAt: now,
      metadata: {
        invoice_no: invoiceNo || null,
        total_amount: quotation.total_amount,
        quotation_id: id,
        description: `Sale from Quotation #${quotation.quotation_no || id}`
      },
    });

    // 5. Update Quotation Status
    await setLastUpdated(quotationsCollection, {
      _id: toObjectId(id),
      user_id: toObjectId(user.id)
    }, {
      status: "converted",
      converted_to_invoice_id: orderId
    });

    return NextResponse.json({ 
      success: true, 
      orderId: orderId.toString(),
      invoiceNo: invoiceNo
    });

  } catch (error: any) {
    console.error("Conversion error:", error);
    return NextResponse.json({ error: error.message || "Failed to convert" }, { status: 500 });
  }
}