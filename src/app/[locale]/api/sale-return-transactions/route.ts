
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/utils";
import {
  getCollection,
  COLLECTIONS,
  toObjectId,
  isValidObjectId,
  setLastUpdated,
  updateUserLastActivity,
} from "@/lib/db/mongodb";
import { appendCustomerLedgerEntry } from "@/lib/ledger/customer-ledger";
import { setDateToCurrentTime } from "@/lib/utils";
import { requirePermission } from "@/lib/auth/rbac";

type SaleReturnItem = {
  id: string;
  productId?: string;
  itemName: string;
  quantity: number;
  rate: number;
  amount: number;
};

function sanitizeItems(items: unknown): SaleReturnItem[] {
  if (!Array.isArray(items)) return [];

  return items
    .map((raw, index) => {
      const item = raw as any;
      const productId = (item.productId || item.product_id || "").toString();
      const quantity =
        typeof item.quantity === "number"
          ? item.quantity
          : parseFloat(item.quantity ?? "0") || 0;
      const rate =
        typeof item.rate === "number" ? item.rate : parseFloat(item.rate ?? "0") || 0;
      const fallbackAmount = Number((quantity * rate).toFixed(2));
      const amount =
        typeof item.amount === "number"
          ? item.amount
          : parseFloat(item.amount ?? "0") || fallbackAmount;

      return {
        id: item.id?.toString() || `item-${index + 1}`,
        productId,
        itemName: item.itemName?.toString().trim() || "",
        quantity,
        rate,
        amount,
      };
    })
    .filter((item) => item.itemName && item.amount > 0);
}

export async function GET(req: NextRequest) {
  try {
    const user = (await getCurrentUser()) as { id: string } | null;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requirePermission("sales.view_sale_return");
    if (!authCheck.allowed) return authCheck.response!;

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const customerId = searchParams.get("customerId");
    const paymentMethodId = searchParams.get("paymentMethod");
    const skip = (page - 1) * limit;

    const collection = await getCollection(COLLECTIONS.SALE_RETURN_TRANSACTIONS);
    
    // Build match query
    const matchQuery: any = { user_id: toObjectId(user.id) };
    if (customerId && customerId !== "all") {
      matchQuery.customer_id = toObjectId(customerId);
    }
    if (paymentMethodId && paymentMethodId !== "all") {
      matchQuery.payment_method_id = paymentMethodId === "cash" || paymentMethodId === "cheque" 
        ? paymentMethodId 
        : toObjectId(paymentMethodId);
    }
    
    // Aggregation pipeline to include customer name for searching
    const pipeline: any[] = [
      { $match: matchQuery },
      {
        $lookup: {
          from: COLLECTIONS.CUSTOMERS,
          localField: "customer_id",
          foreignField: "_id",
          as: "customer"
        }
      },
      { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } }
    ];

    // Add search filter if provided
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { return_number: { $regex: search, $options: "i" } },
            { invoice_no: { $regex: search, $options: "i" } },
            { "customer.name": { $regex: search, $options: "i" } }
          ]
        }
      });
    }

    // Get total count for pagination
    const countPipeline = [...pipeline, { $count: "total" }];
    const countResult = await collection.aggregate(countPipeline).toArray();
    const totalRecords = countResult.length > 0 ? countResult[0].total : 0;
    const totalPages = Math.ceil(totalRecords / limit);

    // Get paginated results
    pipeline.push({ $sort: { date: -1, created_at: -1 } });
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    // Lookup payment methods
    pipeline.push({
      $lookup: {
        from: COLLECTIONS.PAYMENT_METHOD,
        localField: "payment_method_id",
        foreignField: "_id",
        as: "paymentMethod"
      }
    });
    pipeline.push({ $unwind: { path: "$paymentMethod", preserveNullAndEmptyArrays: true } });

    const items = await collection.aggregate(pipeline).toArray();

    const list = items.map((item) => {
      let pmName = "";
      if (item.payment_method_id === "cash") pmName = "Cash";
      else if (item.payment_method_id === "cheque") pmName = "Cheque";
      else pmName = item.paymentMethod?.bank_name ?? "";

      return {
        id: (item._id as { toString: () => string }).toString(),
        returnNumber: item.return_number ?? "",
        customerId: item.customer_id?.toString() ?? "",
        customerName: item.customer?.name ?? "",
        items: Array.isArray(item.items) ? item.items : [],
        totalAmount: item.total_amount ?? item.payment_amount ?? 0,
        paidAmount: item.paid_amount ?? 0,
        balanceDue: item.balance_due ?? Number(((item.total_amount ?? 0) - (item.paid_amount ?? 0)).toFixed(2)),
        paymentAmount: item.payment_amount ?? item.total_amount ?? 0,
        paymentMethodId: item.payment_method_id?.toString() ?? "",
        paymentMethodName: pmName,
        paymentRefNo: item.payment_ref_no ?? "",
        invoiceNo: item.invoice_no ?? "",
        invoiceDate: item.invoice_date ? new Date(item.invoice_date).toISOString().split("T")[0] : "",
        date: item.date ? new Date(item.date).toISOString().split("T")[0] : "",
      };
    });

    await updateUserLastActivity();
    return NextResponse.json({
      transactions: list,
      pagination: {
        totalRecords,
        totalPages,
        currentPage: page,
        limit
      }
    });
  } catch (err: unknown) {
    console.error("sale-return-transactions GET error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = (await getCurrentUser()) as { id: string } | null;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requirePermission("sales.create_sale_return");
    if (!authCheck.allowed) return authCheck.response!;

    const body = await req.json();
    const customerId = body?.customerId ?? body?.customer_id ?? "";
    const returnNumber = (body?.returnNumber ?? body?.return_number ?? "").toString().trim();
    const lineItems = sanitizeItems(body?.items);
    const totalAmount =
      typeof body?.totalAmount === "number"
        ? body.totalAmount
        : parseFloat(body?.totalAmount) || 0;
    const paidAmount =
      typeof body?.paidAmount === "number"
        ? body.paidAmount
        : parseFloat(body?.paidAmount) || 0;
    const paymentAmount = totalAmount;
    const balanceDue = Number((paymentAmount - paidAmount).toFixed(2));
    const paymentMethodId = body?.paymentMethodId ?? body?.payment_method_id ?? "";
    const paymentRefNo = (body?.paymentRefNo ?? body?.payment_ref_no ?? "")
      .toString()
      .trim();
    const invoiceNo = (body?.invoiceNo ?? body?.invoice_no ?? "").toString().trim();
    const invoiceDateRaw = (body?.invoiceDate ?? body?.invoice_date ?? "")
      .toString()
      .trim();
    const dateStr = body?.date ?? new Date().toISOString().split("T")[0];

    if (!customerId || !isValidObjectId(customerId)) {
      return NextResponse.json(
        { error: "Valid customer is required" },
        { status: 400 }
      );
    }

    if (!returnNumber) {
      return NextResponse.json(
        { error: "Return number is required" },
        { status: 400 }
      );
    }

    const isHardcodedMethod = paymentMethodId === "cash" || paymentMethodId === "cheque";
    if (!paymentMethodId || (!isHardcodedMethod && !isValidObjectId(paymentMethodId))) {
      return NextResponse.json(
        { error: "Valid payment method is required" },
        { status: 400 }
      );
    }

    if (paymentAmount <= 0) {
      return NextResponse.json(
        { error: "Sale return amount must be greater than 0" },
        { status: 400 }
      );
    }

    if (paidAmount < 0 || paidAmount > paymentAmount) {
      return NextResponse.json(
        { error: "Paid amount must be between 0 and total amount" },
        { status: 400 }
      );
    }

    if (lineItems.length === 0) {
      return NextResponse.json(
        { error: "At least one return item is required" },
        { status: 400 }
      );
    }

    const date = setDateToCurrentTime(dateStr);
    const invoiceDate = invoiceDateRaw ? setDateToCurrentTime(invoiceDateRaw) : null;

    const collection = await getCollection(COLLECTIONS.SALE_RETURN_TRANSACTIONS);
    const now = new Date();
    const result = await collection.insertOne({
      user_id: toObjectId(user.id),
      return_number: returnNumber,
      customer_id: toObjectId(customerId),
      items: lineItems,
      total_amount: paymentAmount,
      paid_amount: paidAmount,
      balance_due: balanceDue,
      payment_amount: paymentAmount,
      payment_method_id: isHardcodedMethod
        ? paymentMethodId
        : toObjectId(paymentMethodId),
      payment_ref_no: paymentRefNo,
      invoice_no: invoiceNo,
      invoice_date: invoiceDate,
      date,
      created_at: now,
      updated_at: now,
    });

    const insertedId = result.insertedId;
    if (!insertedId) {
      return NextResponse.json(
        { error: "Failed to create record" },
        { status: 500 }
      );
    }

    // Increment stock for returned products
    const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
    for (const item of lineItems) {
      if (!item.productId || !isValidObjectId(item.productId)) continue;
      
      const productDoc = await productsCollection.findOne(
        { _id: toObjectId(item.productId) },
        { projection: { type: 1, quantity: 1, in_stock: 1 } }
      );
      
      if (!productDoc) continue;
      
      const productType = (productDoc as { type?: string }).type;
      const isGoods = !productType || productType === "goods" || productType === "good";
      if (!isGoods) continue;

      const returnQty = item.quantity || 0;
      if (returnQty <= 0) continue;

      const productQuantity = (productDoc as { quantity?: number }).quantity;
      const productInStock = (productDoc as { in_stock?: number }).in_stock;
      const stockField = productQuantity !== undefined && productQuantity !== null
        ? "quantity"
        : productInStock !== undefined && productInStock !== null
          ? "in_stock"
          : "quantity";

      await productsCollection.updateOne(
        { _id: toObjectId(item.productId) },
        { $inc: { [stockField]: returnQty } }
      );
    }

    await appendCustomerLedgerEntry({
      userId: user.id,
      customerId,
      eventKey: `sale_return_credit:${insertedId.toString()}`,
      eventType: "manual_adjustment",
      eventSource: "party_transaction",
      eventSourceId: insertedId.toString(),
      amountDelta: -paymentAmount,
      effectiveAt: date,
      metadata: {
        reason: "sale_return",
        payment_method_id: paymentMethodId,
      },
    });

    if (paidAmount > 0) {
      try {
        await appendCustomerLedgerEntry({
          userId: user.id,
          customerId,
          eventKey: `sale_return_payment_debit:${insertedId.toString()}`,
          eventType: "manual_adjustment",
          eventSource: "party_transaction",
          eventSourceId: insertedId.toString(),
          amountDelta: paidAmount, // Money given back to customer, increases their owed balance to us logically... wait, if positive balance is they owe us, giving them cash means they owe us MORE? No, if they return goods (amountDelta: -paymentAmount), they owe us LESS. If we give them cash back, their balance goes UP (back towards 0). Yes, +paidAmount.
          effectiveAt: date,
          metadata: {
            reason: "sale_return_refund",
            payment_method_id: paymentMethodId,
          },
        });

        // Add transaction for cash leaving the business
        const transactionsCollection = await getCollection(COLLECTIONS.TRANSACTIONS);
        await transactionsCollection.insertOne({
          user_id: toObjectId(user.id),
          amount: paidAmount,
          status: "completed",
          category: "selling", // or refund
          type: "expense", // Because cash is going out
          description: `Refund for sale return #${returnNumber}`,
          payment_date: date,
          payment_method_id: isHardcodedMethod ? paymentMethodId : toObjectId(paymentMethodId),
          order_id: insertedId,
          created_at: now,
        });
      } catch (err) {
        console.error("Error recording sale return payment:", err);
      }
    }

    // ✅ Update user's last activity after successful creation
    const usersCollection = await getCollection(COLLECTIONS.USERS);
    await setLastUpdated(usersCollection, { _id: toObjectId(user.id) });

    await updateUserLastActivity();
    return NextResponse.json({
      id: (insertedId as { toString: () => string }).toString(),
      returnNumber,
      customerId,
      items: lineItems,
      totalAmount: paymentAmount,
      paidAmount,
      balanceDue,
      paymentAmount,
      paymentMethodId,
      paymentRefNo,
      invoiceNo,
      invoiceDate: invoiceDate ? invoiceDate.toISOString().split("T")[0] : "",
      date: date.toISOString().split("T")[0],
    });
  } catch (err: unknown) {
    console.error("sale-return-transactions POST error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";