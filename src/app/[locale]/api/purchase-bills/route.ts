
// src/app/[locale]/api/purchase-bills/route.ts
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
import { appendPartyLedgerEntry } from "@/lib/ledger/customer-ledger";
import { setDateToCurrentTime } from "@/lib/utils";
import { ObjectId } from "mongodb";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Helper to check if product is goods (not service)
function isGoodsProduct(productDoc: any): boolean {
  const type = productDoc?.type;
  return !type || type === "goods" || type === "good";
}

// Increment stock for purchase bill items
async function applyPurchaseBillStock(
  productsCollection: any,
  items: any[]
): Promise<void> {
  if (!items || !Array.isArray(items)) return;

  for (const item of items) {
    if (!item.product_id || !isValidObjectId(item.product_id.toString())) {
      continue;
    }
    const productDoc = await productsCollection.findOne({ _id: toObjectId(item.product_id.toString()) });
    if (!productDoc) continue;
    if (!isGoodsProduct(productDoc)) continue;

    const qty = Number(item.quantity) || 0;
    if (qty <= 0) continue;

    const stockField =
      productDoc.quantity !== undefined && productDoc.quantity !== null
        ? "quantity"
        : productDoc.in_stock !== undefined && productDoc.in_stock !== null
          ? "in_stock"
          : "quantity";

    await productsCollection.updateOne(
      { _id: toObjectId(item.product_id.toString()) },
      { $inc: { [stockField]: qty } }
    );
  }
}

// Revert/Deduct stock for purchase bill items (reversing purchase)
async function reversePurchaseBillStock(
  productsCollection: any,
  items: any[]
): Promise<void> {
  if (!items || !Array.isArray(items)) return;

  for (const item of items) {
    if (!item.product_id || !isValidObjectId(item.product_id.toString())) {
      continue;
    }
    const productDoc = await productsCollection.findOne({ _id: toObjectId(item.product_id.toString()) });
    if (!productDoc) continue;
    if (!isGoodsProduct(productDoc)) continue;

    const qty = Number(item.quantity) || 0;
    if (qty <= 0) continue;

    const stockField =
      productDoc.quantity !== undefined && productDoc.quantity !== null
        ? "quantity"
        : productDoc.in_stock !== undefined && productDoc.in_stock !== null
          ? "in_stock"
          : "quantity";

    await productsCollection.updateOne(
      { _id: toObjectId(item.product_id.toString()) },
      { $inc: { [stockField]: -qty } }
    );
  }
}


export async function GET(request: Request) {
  const user = (await getCurrentUser()) as { id: string } | null;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const billId = url.searchParams.get("id");
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "10");
  const search = url.searchParams.get("search") || "";
  const skip = (page - 1) * limit;

  const purchaseBillsCollection = await getCollection(COLLECTIONS.PURCHASE_BILLS);

  try {
    if (billId) {
      if (!isValidObjectId(billId)) {
        return NextResponse.json({ error: "Invalid bill ID" }, { status: 400 });
      }
      const bill = await purchaseBillsCollection.findOne({
        _id: toObjectId(billId),
        user_id: toObjectId(user.id),
      });

      if (!bill) {
        return NextResponse.json({ error: "Bill not found" }, { status: 404 });
      }

      return NextResponse.json({
        ...bill,
        id: bill._id.toString(),
        party_id: bill.party_id.toString(),
      });
    }

    // Match query
    const matchQuery: any = { user_id: toObjectId(user.id) };

    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), "i");
      matchQuery.$or = [
        { party_name: searchRegex },
        { description: searchRegex },
      ];
    }

    const pipeline: any[] = [
      { $match: matchQuery },
      { $sort: { created_at: -1 } },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [{ $skip: skip }, { $limit: limit }],
        },
      },
    ];

    const result = await purchaseBillsCollection.aggregate(pipeline).toArray();
    const bills = result[0].data || [];
    const total = result[0].metadata[0]?.total || 0;

    const formattedBills = bills.map((bill: any) => ({
      id: bill._id.toString(),
      party_id: bill.party_id.toString(),
      party_name: bill.party_name,
      items: bill.items || [],
      discount: bill.discount || 0,
      discount_type: bill.discount_type || "fixed",
      tax: bill.tax || 0,
      tax_type: bill.tax_type || "fixed",
      total_amount: bill.total_amount,
      paid_amount: bill.paid_amount || 0,
      balance_due: bill.balance_due || 0,
      is_paid: bill.is_paid || false,
      payment_method_id: bill.payment_method_id || null,
      payment_method_name: bill.payment_method_name || null,
      description: bill.description || null,
      created_at: bill.created_at,
      updated_at: bill.updated_at || null,
    }));

    await updateUserLastActivity();
    return NextResponse.json({
      bills: formattedBills,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: unknown) {
    console.error("Error fetching purchase bills:", error);
    return NextResponse.json(
      { error: "Failed to fetch purchase bills" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const user = (await getCurrentUser()) as { id: string } | null;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    party_id: partyId,
    party_name: partyName,
    items,
    discount,
    discount_type: discountType,
    tax,
    tax_type: taxType,
    total_amount: totalAmount,
    paid_amount: paidAmount,
    balance_due: balanceDue,
    is_paid: isPaid = false,
    payment_method_id: paymentMethodId,
    payment_method_name: paymentMethodName,
    description,
  } = await request.json();

  try {
    if (!partyId || !partyName) {
      return NextResponse.json(
        { error: "Party ID and name are required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "At least one item is required" },
        { status: 400 }
      );
    }

    if (typeof totalAmount !== "number" || totalAmount <= 0) {
      return NextResponse.json(
        { error: "Total amount must be greater than 0" },
        { status: 400 }
      );
    }

    const purchaseBillsCollection = await getCollection(
      COLLECTIONS.PURCHASE_BILLS
    );
    const partiesCollection = await getCollection(COLLECTIONS.PARTIES);
    const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);

    const userObjId = toObjectId(user.id);
    const partyObjId = toObjectId(partyId);

    const party = await partiesCollection.findOne(
      { _id: partyObjId, user_id: userObjId },
      { projection: { _id: 1 } }
    );

    if (!party) {
      return NextResponse.json(
        { error: "Party not found" },
        { status: 404 }
      );
    }

    const enrichedItems = await Promise.all(
      items.map(async (item: any) => {
        let productName = item.product_name;
        let productDescription = item.product_description || "";

        if (item.product_id && isValidObjectId(item.product_id)) {
          const productObjId = toObjectId(item.product_id);
          const product = await productsCollection.findOne(
            { _id: productObjId },
            { projection: { name: 1, description: 1 } }
          );
          if (product) {
            productName = productName || product.name;
            productDescription = productDescription || product.description;
          }
        }

        const productId = item.product_id && isValidObjectId(item.product_id) ? toObjectId(item.product_id) : null;

        return {
          product_id: productId,
          product_name: productName,
          product_description: productDescription,
          quantity: Number(item.quantity) || 0,
          cost_price: Number(item.cost_price) || 0,
          amount: Number(item.amount) || 0,
        };
      })
    );

    const finalPaidAmount = Number(paidAmount) || 0;
    if (finalPaidAmount > totalAmount) {
      return NextResponse.json(
        { error: "Paid amount cannot exceed total amount" },
        { status: 400 }
      );
    }
    const finalBalanceDue = totalAmount - finalPaidAmount;
    const finalIsPaid = finalBalanceDue === 0;

    const now = new Date();

    const billResult = await purchaseBillsCollection.insertOne({
      user_id: userObjId,
      party_id: partyObjId,
      party_name: partyName,
      items: enrichedItems,
      discount: Number(discount) || 0,
      discount_type: discountType || "fixed",
      tax: Number(tax) || 0,
      tax_type: taxType || "fixed",
      total_amount: totalAmount,
      paid_amount: finalPaidAmount,
      balance_due: finalBalanceDue,
      is_paid: finalIsPaid,
      payment_method_id: paymentMethodId || null,
      payment_method_name: paymentMethodName || null,
      description: description || null,
      created_at: now,
      updated_at: now,
    });

    // Apply stock increment for purchase
    await applyPurchaseBillStock(productsCollection, enrichedItems);

    // Record ledger entry
    if (totalAmount !== 0) {
      try {
        await appendPartyLedgerEntry({
          userId: user.id,
          partyId: partyId,
          eventKey: `purchase_bill_${billResult.insertedId.toString()}`,
          eventType: "purchase_bill_debit",
          eventSource: "party_transaction",
          eventSourceId: billResult.insertedId.toString(),
          amountDelta: totalAmount,
          effectiveAt: now,
          metadata: {
            bill_id: billResult.insertedId.toString(),
            party_name: partyName,
          },
        });
      } catch (ledgerError) {
        console.error("Error recording ledger entry:", ledgerError);
      }
    }

    // ✅ Update user's last activity
    const usersCollection = await getCollection(COLLECTIONS.USERS);
    await setLastUpdated(usersCollection, { _id: toObjectId(user.id) });

    await updateUserLastActivity();
    return NextResponse.json(
      {
        success: true,
        id: billResult.insertedId.toString(),
        message: "Purchase bill created successfully",
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Error creating purchase bill:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to create purchase bill";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const user = (await getCurrentUser()) as { id: string } | null;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    id,
    party_id: partyId,
    party_name: partyName,
    items,
    discount,
    discount_type: discountType,
    tax,
    tax_type: taxType,
    total_amount: totalAmount,
    paid_amount: paidAmount,
    balance_due: balanceDue,
    is_paid: isPaid,
    payment_method_id: paymentMethodId,
    payment_method_name: paymentMethodName,
    description,
  } = await request.json();

  try {
    if (!id) {
      return NextResponse.json(
        { error: "Bill ID is required" },
        { status: 400 }
      );
    }

    const purchaseBillsCollection = await getCollection(
      COLLECTIONS.PURCHASE_BILLS
    );
    const userObjId = toObjectId(user.id);
    const billObjId = toObjectId(id);
    const filter = { _id: billObjId, user_id: userObjId };

    // Fetch existing bill to revert old stock
    const oldBill = await purchaseBillsCollection.findOne(filter);
    if (!oldBill) {
      return NextResponse.json(
        { error: "Purchase bill not found" },
        { status: 404 }
      );
    }

    const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);

    // Revert stock of old items
    if (oldBill.items && Array.isArray(oldBill.items)) {
      await reversePurchaseBillStock(productsCollection, oldBill.items);
    }

    // Process new items if provided in request
    let enrichedItems = oldBill.items;
    if (Array.isArray(items)) {
      enrichedItems = await Promise.all(
        items.map(async (item: any) => {
          let productName = item.product_name;
          let productDescription = item.product_description || "";

          if (item.product_id && isValidObjectId(item.product_id)) {
            const productObjId = toObjectId(item.product_id);
            const product = await productsCollection.findOne(
              { _id: productObjId },
              { projection: { name: 1, description: 1 } }
            );
            if (product) {
              productName = productName || product.name;
              productDescription = productDescription || product.description;
            }
          }

          const productId = item.product_id && isValidObjectId(item.product_id) ? toObjectId(item.product_id) : null;

          return {
            product_id: productId,
            product_name: productName,
            product_description: productDescription,
            quantity: Number(item.quantity) || 0,
            cost_price: Number(item.cost_price) || 0,
            amount: Number(item.amount) || 0,
          };
        })
      );
    }

    // Apply new stock
    await applyPurchaseBillStock(productsCollection, enrichedItems);

    const finalPaidAmount = Number(paidAmount) || 0;
    if (finalPaidAmount > totalAmount) {
      return NextResponse.json(
        { error: "Paid amount cannot exceed total amount" },
        { status: 400 }
      );
    }
    const finalBalanceDue = totalAmount - finalPaidAmount;
    const finalIsPaid = finalBalanceDue === 0;

    // Prepare update fields (without updated_at, helper will add it)
    const updateData: any = {
      discount: Number(discount),
      discount_type: discountType || "fixed",
      tax: Number(tax),
      tax_type: taxType || "fixed",
      total_amount: totalAmount,
      paid_amount: finalPaidAmount,
      balance_due: finalBalanceDue,
      is_paid: finalIsPaid,
      payment_method_id: paymentMethodId || null,
      payment_method_name: paymentMethodName || null,
      description: description || null,
    };

    if (partyId && isValidObjectId(partyId)) {
      updateData.party_id = toObjectId(partyId);
    }
    if (partyName) {
      updateData.party_name = partyName;
    }
    if (Array.isArray(items)) {
      updateData.items = enrichedItems;
    }

    // ✅ Use setLastUpdated helper
    const updateResult = await setLastUpdated(
      purchaseBillsCollection,
      filter,
      updateData
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json(
        { error: "Purchase bill not found" },
        { status: 404 }
      );
    }

    // ✅ Update user's last activity
    const usersCollection = await getCollection(COLLECTIONS.USERS);
    await setLastUpdated(usersCollection, { _id: toObjectId(user.id) });

    await updateUserLastActivity();
    return NextResponse.json({
      success: true,
      message: "Purchase bill updated successfully",
    });
  } catch (error: unknown) {
    console.error("Error updating purchase bill:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to update purchase bill";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = (await getCurrentUser()) as { id: string } | null;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  try {
    if (!id) {
      return NextResponse.json(
        { error: "Bill ID is required" },
        { status: 400 }
      );
    }

    const purchaseBillsCollection = await getCollection(
      COLLECTIONS.PURCHASE_BILLS
    );

    const userObjId = toObjectId(user.id);
    const billObjId = toObjectId(id);

    // Fetch existing bill to reverse stock before deletion
    const oldBill = await purchaseBillsCollection.findOne({
      _id: billObjId,
      user_id: userObjId,
    });

    if (!oldBill) {
      return NextResponse.json(
        { error: "Purchase bill not found" },
        { status: 404 }
      );
    }

    const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);

    // Reverse stock of all items
    if (oldBill.items && Array.isArray(oldBill.items)) {
      await reversePurchaseBillStock(productsCollection, oldBill.items);
    }

    const result = await purchaseBillsCollection.deleteOne({
      _id: billObjId,
      user_id: userObjId,
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: "Purchase bill not found" },
        { status: 404 }
      );
    }

    // ✅ Update user's last activity after deletion
    const usersCollection = await getCollection(COLLECTIONS.USERS);
    await setLastUpdated(usersCollection, { _id: toObjectId(user.id) });

    await updateUserLastActivity();
    return NextResponse.json({
      success: true,
      message: "Purchase bill deleted successfully",
    });
  } catch (error: unknown) {
    console.error("Error deleting purchase bill:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to delete purchase bill";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}