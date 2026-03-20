import { getCollection, COLLECTIONS, toObjectId } from "@/lib/db/mongodb";
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
    balance:
      customer.balance !== undefined
        ? customer.balance
        : customer.opening_balance,
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
    const result = await customersCollection.insertOne({
      ...newCustomer,
      user_id: toObjectId(user.id),
      created_at: new Date(),
      updated_at: new Date(),
    });

    if (!result.insertedId) {
      return NextResponse.json(
        { error: "Failed to create customer" },
        { status: 500 },
      );
    }

    const customer = await customersCollection.findOne({
      _id: result.insertedId,
    });

    if (customer?._id) {
      const openingBalance =
        customer.opening_balance ?? customer.balance ?? 0;
      await seedCustomerOpeningBalance(
        user.id,
        customer._id.toString(),
        openingBalance,
        customer.created_at ?? new Date()
      );
    }

    return NextResponse.json({
      id: customer?._id.toString(),
      name: customer?.name,
      email: customer?.email,
      phone: customer?.phone,
      company_name: customer?.company_name,
      company_address: customer?.company_address,
      balance:
        customer?.balance !== undefined
          ? customer?.balance
          : customer?.opening_balance,
      status: customer?.status || "active",
      is_delete: customer?.is_delete || 0,
    });
  } catch (error: any) {
    console.error("Error creating customer:", error);
    if (error.code === 11000) {
      return NextResponse.json(
        { error: "A customer with this email already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Internal Server Error: " + (error as Error).message },
      { status: 500 },
    );
  }
}
