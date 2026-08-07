// src/app/[locale]/api/transactions/route.ts
import {
  getCollection,
  COLLECTIONS,
  toObjectId,
  setLastUpdated,
  updateUserLastActivity,
} from "@/lib/db/mongodb";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/utils";
import { requireAnyPermission } from "@/lib/auth/rbac";

export async function GET(request: Request) {
  const user = (await getCurrentUser()) as { id: string } | null;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authCheck = await requireAnyPermission([
    "sales.view_payment_in", 
    "purchase.view_payment_out", 
    "expenses.view"
  ]);
  if (!authCheck.allowed) return authCheck.response!;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "25");
  const sortColumn = searchParams.get("sortColumn") || "created_at";
  const sortDirection = searchParams.get("sortDirection") || "desc";
  const year = searchParams.get("year");
  const fromDate = searchParams.get("fromDate");
  const toDate = searchParams.get("toDate");
  const fromDateTime = searchParams.get("fromDateTime");
  const toDateTime = searchParams.get("toDateTime");
  const all = searchParams.get("all") === "true";

  const offset = (page - 1) * limit;
  const transactionsCollection = await getCollection(COLLECTIONS.TRANSACTIONS);
  const filter: Record<string, unknown> = { user_id: toObjectId(user.id) };

  if (fromDateTime && toDateTime) {
    const startDate = new Date(fromDateTime);
    const endDate = new Date(toDateTime);

    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      startDate > endDate
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid fromDateTime/toDateTime range: provide valid datetimes with a start that is before or equal to the end",
        },
        { status: 400 },
      );
    }

    filter.created_at = { $gte: startDate, $lte: endDate };
  } else if (fromDate && toDate) {
    const startDate = new Date(fromDate + "T00:00:00.000Z");
    const endDate = new Date(toDate + "T23:59:59.999Z");
    filter.created_at = { $gte: startDate, $lte: endDate };
  } else if (year) {
    const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);
    const endOfYear = new Date(`${year}-12-31T23:59:59.999Z`);
    filter.created_at = { $gte: startOfYear, $lte: endOfYear };
  }

  const count = await transactionsCollection.countDocuments(filter);
  let data;
  if (all) {
    data = await transactionsCollection
      .find(filter)
      .sort({ [sortColumn]: sortDirection === "asc" ? 1 : -1 })
      .toArray();
  } else {
    data = await transactionsCollection
      .find(filter)
      .sort({ [sortColumn]: sortDirection === "asc" ? 1 : -1 })
      .skip(offset)
      .limit(limit)
      .toArray();
  }

  const transactions = data.map((transaction) => ({
    ...transaction,
    id: transaction._id.toString(),
    _id: undefined,
    user_id: transaction.user_id.toString(),
  }));

  await updateUserLastActivity(user.id);
  return NextResponse.json({
    data: transactions,
    total: count,
    page,
    limit,
    totalPages: Math.ceil(count / limit),
  });
}

export async function POST(request: Request) {
  const user = (await getCurrentUser()) as { id: string } | null;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authCheck = await requireAnyPermission([
    "sales.create_payment_in", 
    "purchase.create_payment_out", 
    "expenses.create"
  ]);
  if (!authCheck.allowed) return authCheck.response!;

  const newTransaction = await request.json();
  const now = new Date();

  const transactionsCollection = await getCollection(COLLECTIONS.TRANSACTIONS);
  const result = await transactionsCollection.insertOne({
    ...newTransaction,
    productId:
      newTransaction.productId &&
      typeof newTransaction.productId === "string" &&
      newTransaction.productId.match(/^[0-9a-fA-F]{24}$/)
        ? toObjectId(newTransaction.productId)
        : newTransaction.productId,
    user_id: toObjectId(user.id),
    created_at: newTransaction.created_at
      ? new Date(newTransaction.created_at)
      : now,
    updated_at: now, // ✅ added updated_at
  });

  if (!result.insertedId) {
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 },
    );
  }

  // Handle stock deduction for counter sale
  if (newTransaction.productId && newTransaction.productId !== "0" && newTransaction.quantity) {
    const qtyNum = Number(newTransaction.quantity) || 0;
    const incVal = newTransaction.type === "income" ? -qtyNum : qtyNum;
    if (incVal !== 0) {
      const { adjustStock } = await import('@/lib/db/stock-manager');
      await adjustStock(newTransaction.productId, user.id, incVal);
    }
  }

  // ✅ Update user's last activity
  const usersCollection = await getCollection(COLLECTIONS.USERS);
  await setLastUpdated(usersCollection, { _id: toObjectId(user.id) }, undefined, user.id);

  const transaction = await transactionsCollection.findOne({
    _id: result.insertedId,
  });

  await updateUserLastActivity(user.id);
  return NextResponse.json({
    ...transaction,
    id: transaction?._id.toString(),
    _id: undefined,
    user_id: transaction?.user_id.toString(),
  });
}
