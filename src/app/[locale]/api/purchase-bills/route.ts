
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

export async function GET(request: Request) {
  const user = (await getCurrentUser()) as { id: string } | null;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const billId = url.searchParams.get("id");

  const purchaseBillsCollection = await getCollection(
    COLLECTIONS.PURCHASE_BILLS
  );
  const partiesCollection = await getCollection(COLLECTIONS.PARTIES);

  try {
    let bills;

    if (billId) {
      if (!isValidObjectId(billId)) {
        return NextResponse.json(
          { error: "Invalid bill ID" },
          { status: 400 }
        );
      }
      const billObjId = toObjectId(billId);
      const bill = await purchaseBillsCollection.findOne({
        _id: billObjId,
        user_id: toObjectId(user.id),
      });

      if (!bill) {
        return NextResponse.json(
          { error: "Bill not found" },
          { status: 404 }
        );
      }
      bills = [bill];
    } else {
      bills = await purchaseBillsCollection
        .find({ user_id: toObjectId(user.id) })
        .sort({ created_at: -1 })
        .toArray();
    }

    const billsWithParties = await Promise.all(
      bills.map(async (bill) => {
        const party = await partiesCollection.findOne(
          { _id: bill.party_id },
          { projection: { name: 1, email: 1, phone: 1, company_name: 1 } }
        );

        return {
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
          party: party
            ? {
                name: party.name,
                email: party.email,
                phone: party.phone,
                company_name: party.company_name,
              }
            : null,
        };
      })
    );

    await updateUserLastActivity();
    return NextResponse.json(billId ? billsWithParties[0] : billsWithParties);
  } catch (error: unknown) {
    console.error("Error fetching purchase bills:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to fetch purchase bills";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
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

        return {
          product_id: item.product_id || null,
          product_name: productName,
          product_description: productDescription,
          quantity: Number(item.quantity) || 0,
          cost_price: Number(item.cost_price) || 0,
          amount: Number(item.amount) || 0,
        };
      })
    );

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
      paid_amount: isPaid ? Number(paidAmount) || 0 : 0,
      balance_due: balanceDue || totalAmount,
      is_paid: isPaid || false,
      payment_method_id: paymentMethodId || null,
      payment_method_name: paymentMethodName || null,
      description: description || null,
      created_at: now,
      updated_at: now,
    });

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

    // Prepare update fields (without updated_at, helper will add it)
    const updateData = {
      discount: Number(discount),
      discount_type: discountType || "fixed",
      tax: Number(tax),
      tax_type: taxType || "fixed",
      total_amount: totalAmount,
      paid_amount: isPaid ? Number(paidAmount) || 0 : 0,
      balance_due: balanceDue,
      is_paid: isPaid || false,
      payment_method_id: paymentMethodId || null,
      payment_method_name: paymentMethodName || null,
      description: description || null,
    };

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