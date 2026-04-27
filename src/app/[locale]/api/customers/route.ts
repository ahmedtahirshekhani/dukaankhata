
// src/app/[locale]/api/customers/route.ts
import { getCollection, COLLECTIONS, toObjectId, setLastUpdated } from "@/lib/db/mongodb";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/utils";
import { seedCustomerOpeningBalance } from "@/lib/ledger/customer-ledger";

export async function GET(request: Request) {
  const user = (await getCurrentUser()) as { id: string } | null;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);
  const data = await customersCollection
    .find(
      { user_id: toObjectId(user.id), is_delete: { $ne: 1 } },
      {
        projection: {
          _id: 1,
          name: 1,
          email: 1,
          phone: 1,
          company_name: 1,
          company_address: 1,
          opening_balance: 1,
          balance: 1,
          status: 1,
          is_delete: 1,
        },
      },
    )
    .toArray();

  const customers = data.map((customer) => ({
    id: customer._id.toString(),
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    company_name: customer.company_name,
    company_address: customer.company_address,
    opening_balance: customer.opening_balance ?? 0,
    balance: customer.balance !== undefined ? customer.balance : customer.opening_balance,
    status: customer.status || "active",
    is_delete: customer.is_delete || 0,
  }));

  return NextResponse.json(customers);
}

export async function POST(request: Request) {
  try {
    const user = (await getCurrentUser()) as { id: string } | null;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let newCustomer = await request.json();

    if (newCustomer.email === "") {
      delete newCustomer.email;
    }

    if (!newCustomer.name || newCustomer.name.trim() === "") {
      return NextResponse.json(
        { error: "Customer name is required" },
        { status: 400 },
      );
    }

    if (newCustomer.balance !== undefined) {
      newCustomer.opening_balance = newCustomer.balance;
    }

    const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);

    const existingCustomer = await customersCollection.findOne({
      user_id: toObjectId(user.id),
      name: newCustomer.name,
      is_delete: { $ne: 1 },
    });

    if (existingCustomer) {
      return NextResponse.json(
        { error: "A party with this name already exists" },
        { status: 409 },
      );
    }

    const now = new Date();
    const result = await customersCollection.insertOne({
      ...newCustomer,
      user_id: toObjectId(user.id),
      created_at: now,
      updated_at: now,
    });

    if (!result.insertedId) {
      return NextResponse.json(
        { error: "Failed to create customer" },
        { status: 500 },
      );
    }

    // Update user's last activity
    const usersCollection = await getCollection(COLLECTIONS.USERS);
    await setLastUpdated(usersCollection, { _id: toObjectId(user.id) });

    const customer = await customersCollection.findOne({
      _id: result.insertedId,
    });

    if (customer?._id) {
      const openingBalance = customer.opening_balance ?? customer.balance ?? 0;
      await seedCustomerOpeningBalance(
        user.id,
        customer._id.toString(),
        openingBalance,
        customer.created_at ?? now
      );
    }

    return NextResponse.json({
      id: customer?._id.toString(),
      name: customer?.name,
      email: customer?.email,
      phone: customer?.phone,
      company_name: customer?.company_name,
      company_address: customer?.company_address,
      balance: customer?.balance !== undefined ? customer?.balance : customer?.opening_balance,
      status: customer?.status || "active",
      is_delete: customer?.is_delete || 0,
    });
  } catch (error: any) {
    console.error("Error creating customer:", error);
    return NextResponse.json(
      { error: "Internal Server Error: " + (error as Error).message },
      { status: 500 },
    );
  }
}