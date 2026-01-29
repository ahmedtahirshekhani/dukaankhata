import {
  getCollection,
  COLLECTIONS,
  toObjectId,
  isValidObjectId,
} from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth-utils";
import { NextResponse } from "next/server";

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

  
  if (updatedCustomer.balance !== undefined) {
    updatedCustomer.opening_balance = updatedCustomer.balance;
  }

  delete updatedCustomer.id;

  const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);
  const result = await customersCollection.findOneAndUpdate(
    {
      _id: toObjectId(customerId),
      user_id: toObjectId(user.id),
    },
    {
      $set: {
        ...updatedCustomer,
        user_id: toObjectId(user.id),
        updated_at: new Date(),
      },
    },
    { returnDocument: "after" },
  );

  if (!result) {
    return NextResponse.json(
      { error: "Customer not found or not authorized" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    id: result._id.toString(),
    name: result.name,
    email: result.email,
    phone: result.phone,
    company_name: result.company_name,
    company_address: result.company_address,
    balance:
      result.balance !== undefined ? result.balance : result.opening_balance,
    status: result.status || "active",
    is_delete: result.is_delete || 0,
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

  return NextResponse.json({ message: "Customer deleted successfully" });
}
