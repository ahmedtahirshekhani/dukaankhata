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
import { requirePermission } from "@/lib/auth/rbac";
import { appendCustomerLedgerEntry } from "@/lib/ledger/customer-ledger";

export async function POST(
  request: Request,
  { params }: { params: { id: string; locale: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authCheck = await requirePermission("sales.create_invoice");
  if (!authCheck.allowed) return authCheck.response!;

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
    // Invoice number format: INV- + quotation_no (or fallback to id)
    const invoiceNo = `INV-${quotation.quotation_no || id.slice(-6)}`.toUpperCase();

    // 1. Prepare Order Items
    const orderItems = quotation.items.map((item: any) => ({
      product_id: item.product_id ? toObjectId(item.product_id) : null,
      name: item.product_name || item.name,
      description: item.product_description || item.description || "",
      quantity: Number(item.quantity || 0),
      quantityType: "prime",
      price: Number(item.unit_price || item.sell_price || item.price || 0),
      discount: Number(item.discount || 0),
      discountType: item.discount_type || "fixed",
      unit_of_measurement: item.uom || item.unit_of_measurement || "",
    }));

    // 2. Insert Order
    const orderDoc: any = {
      customer_id: toObjectId(quotation.party_id),
      party_name: quotation.party_name,
      total_amount: Number(quotation.total_amount || 0),
      subtotal: Number(quotation.total_amount || 0),
      invoice_no: invoiceNo,
      sale_date: now,
      due_date: null,
      charges: [],
      overallDiscount: Number(quotation.discount || 0),
      discountType: quotation.discount_type || "fixed",
      tax: Number(quotation.tax || 0),
      taxType: quotation.tax_type || "fixed",
      shippingCharges: 0,
      items: orderItems,
      payment: {
        method: "cash",
        paid_amount: 0,
        paid_date: null,
        no_payment_at_all: true,
      },
      user_id: toObjectId(user.id),
      status: "completed",
      created_at: now,
      updated_at: now,
      quotation_id: toObjectId(id),
      notes: quotation.notes || `Converted from Quotation ${quotation.quotation_no || id}`,
    };

    const orderResult = await ordersCollection.insertOne(orderDoc);
    const orderId = orderResult.insertedId;

    if (!orderId) {
      throw new Error("Failed to create order");
    }

    const orderIdStr = orderId.toString();

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
    const partyIdStr = quotation.party_id.toString();
    await appendCustomerLedgerEntry({
      userId: user.id,
      customerId: partyIdStr,
      eventKey: `order_debit:${orderIdStr}`,
      eventType: "order_debit",
      eventSource: "order",
      eventSourceId: orderIdStr,
      amountDelta: Number(quotation.total_amount || 0),
      effectiveAt: now,
      metadata: {
        invoice_no: invoiceNo,
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