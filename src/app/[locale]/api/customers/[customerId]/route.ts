
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
import { NextResponse } from "next/server";
import { setCustomerBalanceTarget } from "@/lib/ledger/customer-ledger";

export async function PUT(
  request: Request,
  { params }: { params: { customerId: string } },
) {
  const user = (await getCurrentUser()) as { id: string } | null;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let updatedCustomer = await request.json();
  const customerId = params.customerId;

  if (!isValidObjectId(customerId)) {
    return NextResponse.json({ error: "Invalid customer ID" }, { status: 400 });
  }

  const explicitBalanceProvided = updatedCustomer.balance !== undefined;

  if (updatedCustomer.balance !== undefined) {
    updatedCustomer.opening_balance = updatedCustomer.balance;
  }

  delete updatedCustomer.id;

  const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);
  const filter = {
    _id: toObjectId(customerId),
    user_id: toObjectId(user.id),
  };

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

  // Fetch updated document
  const resultDoc = await customersCollection.findOne(filter);

  if (!resultDoc) {
    return NextResponse.json(
      { error: "Customer not found after update" },
      { status: 404 },
    );
  }

  // Update user's last activity
  const usersCollection = await getCollection(COLLECTIONS.USERS);
  await setLastUpdated(usersCollection, { _id: toObjectId(user.id) });

  if (explicitBalanceProvided && Number.isFinite(Number(updatedCustomer.balance))) {
    await setCustomerBalanceTarget(
      user.id,
      customerId,
      Number(updatedCustomer.balance),
      `customer_balance_set:${customerId}:${Number(updatedCustomer.balance)}`,
      new Date(),
      {
        reason: "customer_profile_balance_update",
      }
    );
  }

  await updateUserLastActivity();
  return NextResponse.json({
    id: resultDoc._id.toString(),
    name: resultDoc.name,
    email: resultDoc.email,
    phone: resultDoc.phone,
    company_name: resultDoc.company_name,
    company_address: resultDoc.company_address,
    balance: resultDoc.balance !== undefined ? resultDoc.balance : resultDoc.opening_balance,
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

  const customerId = params.customerId;

  if (!isValidObjectId(customerId)) {
    return NextResponse.json({ error: "Invalid customer ID" }, { status: 400 });
  }

  const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);
  const result = await customersCollection.deleteOne({
    _id: toObjectId(customerId),
    user_id: toObjectId(user.id),
  });

  if (result.deletedCount === 0) {
    return NextResponse.json(
      { error: "Customer not found or not authorized" },
      { status: 404 },
    );
  }

  // Update user's last activity after deletion
  const usersCollection = await getCollection(COLLECTIONS.USERS);
  await setLastUpdated(usersCollection, { _id: toObjectId(user.id) });

  await updateUserLastActivity();
  return NextResponse.json({ message: "Customer deleted successfully" });
}