//src/app/[locale]/api/customers/[customerId]/route.ts
import {
  getCollection,
  COLLECTIONS,
  toObjectId,
  isValidObjectId,
  setLastUpdated,
  updateUserLastActivity,
} from "@/lib/db/mongodb";
import { getCurrentUser } from "@/lib/auth/utils";
import { requirePermission } from "@/lib/auth/rbac";
import { NextResponse } from "next/server";
import { appendPartyLedgerEntry, reconcilePartyBalanceServer } from "@/lib/ledger/customer-ledger";

export async function GET(
  request: Request,
  { params }: { params: { customerId: string } },
) {
  const user = (await getCurrentUser()) as { id: string } | null;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const authCheck = await requirePermission("customers.view");
  if (!authCheck.allowed) return authCheck.response!;

  const customerId = params.customerId;
  if (!isValidObjectId(customerId)) return NextResponse.json({ error: "Invalid customer ID" }, { status: 400 });

  const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);
  const customer = await customersCollection.findOne({
    _id: toObjectId(customerId),
    $or: [
      { user_id: toObjectId(user.id) },
      { user_id: user.id }
    ]
  });

  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const reconciledBal = await reconcilePartyBalanceServer(user.id, customerId);

  await updateUserLastActivity();
  return NextResponse.json({
    ...customer,
    id: customer._id.toString(),
    balance: reconciledBal,
    _id: undefined,
  });
}

export async function PUT(
  request: Request,
  { params }: { params: { customerId: string } },
) {
  const user = (await getCurrentUser()) as { id: string } | null;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authCheck = await requirePermission("customers.edit");
  if (!authCheck.allowed) return authCheck.response!;

  let updatedCustomer = await request.json();
  const customerId = params.customerId;

  if (!isValidObjectId(customerId)) {
    return NextResponse.json({ error: "Invalid customer ID" }, { status: 400 });
  }

  const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);
  const filter: any = {
    _id: toObjectId(customerId),
    $or: [
      { user_id: toObjectId(user.id) },
      { user_id: user.id }
    ]
  };

  const existingCustomer = await customersCollection.findOne(filter);
  if (!existingCustomer) {
    return NextResponse.json(
      { error: "Customer not found or not authorized" },
      { status: 404 },
    );
  }

  // Handle opening balance delta if opening_balance is provided
  if (updatedCustomer.opening_balance !== undefined) {
    const oldOpening = Number(existingCustomer.opening_balance ?? 0);
    const newOpening = Number(updatedCustomer.opening_balance);
    const delta = newOpening - oldOpening;

    if (delta !== 0 && Number.isFinite(delta)) {
      const currentBalance = Number(existingCustomer.balance ?? existingCustomer.opening_balance ?? 0);
      updatedCustomer.balance = currentBalance + delta;

      try {
        await appendPartyLedgerEntry({
          userId: user.id,
          partyId: customerId,
          eventKey: `opening_balance_adj:${customerId}:${Date.now()}`,
          eventType: "opening_balance",
          eventSource: "party",
          eventSourceId: customerId,
          amountDelta: delta,
          effectiveAt: existingCustomer.created_at || new Date(),
          metadata: {
            source: "opening_balance_edit",
            oldOpening,
            newOpening,
          },
        });
      } catch (ledgerErr) {
        console.error("Error appending opening balance delta to ledger:", ledgerErr);
      }
    }
  } else {
    // If opening_balance wasn't provided, do not overwrite it
    delete updatedCustomer.opening_balance;
  }

  // Clean system / immutable keys from payload to avoid mutating _id or user_id
  delete updatedCustomer.id;
  delete updatedCustomer._id;
  delete updatedCustomer.user_id;
  delete updatedCustomer.created_at;
  delete updatedCustomer.updated_at;

  // Update using setLastUpdated helper
  const updateResult = await setLastUpdated(
    customersCollection,
    filter,
    updatedCustomer
  );

  if (updateResult.matchedCount === 0) {
    return NextResponse.json(
      { error: "Customer not found or not authorized" },
      { status: 404 },
    );
  }

  // Fetch updated document reliably
  const resultDoc = await customersCollection.findOne({ _id: toObjectId(customerId) });

  if (!resultDoc) {
    return NextResponse.json(
      { error: "Customer not found after update" },
      { status: 404 },
    );
  }

  const finalBalance = await reconcilePartyBalanceServer(user.id, customerId);

  // Update user's last activity
  const usersCollection = await getCollection(COLLECTIONS.USERS);
  await setLastUpdated(usersCollection, { _id: toObjectId(user.id) });

  await updateUserLastActivity();
  return NextResponse.json({
    id: resultDoc._id.toString(),
    name: resultDoc.name,
    email: resultDoc.email,
    phone: resultDoc.phone,
    company_name: resultDoc.company_name,
    company_address: resultDoc.company_address,
    opening_balance: resultDoc.opening_balance ?? 0,
    balance: finalBalance,
    status: resultDoc.status || "active",
    is_delete: resultDoc.is_delete || 0,
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: { customerId: string } },
) {
  const user = (await getCurrentUser()) as { id: string } | null;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authCheck = await requirePermission("customers.delete");
  if (!authCheck.allowed) return authCheck.response!;

  const customerId = params.customerId;
  if (!isValidObjectId(customerId)) {
    return NextResponse.json({ error: "Invalid customer ID" }, { status: 400 });
  }

  // Check if customer has associated transactions
  const { checkPartyHasTransactionsServer } = await import("@/lib/entity-checks/server");
  const checkResult = await checkPartyHasTransactionsServer({
    userId: user.id,
    partyId: customerId,
  });

  if (checkResult.hasTransactions) {
    return NextResponse.json(
      {
        error: "has_associated_transactions",
        message: `Cannot delete party because it has associated transactions (${checkResult.summary}).`,
        details: checkResult.details,
      },
      { status: 400 }
    );
  }

  const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);

  // Soft delete: update status to inactive and is_delete to 1
  const updateResult = await customersCollection.updateOne(
    {
      _id: toObjectId(customerId),
      $or: [
        { user_id: toObjectId(user.id) },
        { user_id: user.id }
      ]
    },
    {
      $set: {
        status: "inactive",
        is_delete: 1,
        updated_at: new Date(),
      },
    },
  );

  if (updateResult.matchedCount === 0) {
    return NextResponse.json(
      { error: "Customer not found or not authorized" },
      { status: 404 },
    );
  }

  // Clean up any orphaned shadow ledger entries and balance state for this customer
  try {
    const pleCol = await getCollection(COLLECTIONS.PARTY_LEDGER_ENTRIES);
    await pleCol.deleteMany({
      $or: [
        { party_id: toObjectId(customerId) },
        { party_id: customerId },
        { customer_id: toObjectId(customerId) },
        { customer_id: customerId },
      ],
    });
    const pbsCol = await getCollection(COLLECTIONS.PARTY_BALANCE_STATE);
    await pbsCol.deleteMany({
      $or: [
        { party_id: toObjectId(customerId) },
        { party_id: customerId },
      ],
    });
  } catch (cleanErr) {
    console.warn("Failed to clean up party ledger entries on customer delete:", cleanErr);
  }

  // Update user's last activity
  const usersCollection = await getCollection(COLLECTIONS.USERS);
  await setLastUpdated(usersCollection, { _id: toObjectId(user.id) });

  await updateUserLastActivity();
  return NextResponse.json({ message: "Customer deleted successfully" });
}