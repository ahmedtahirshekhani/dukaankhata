import { getCollection, COLLECTIONS, toObjectId } from "@/lib/db/mongodb";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/utils";

export async function GET(request: Request) {
  const user = (await getCurrentUser()) as { id: string } | null;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get pagination and sort parameters from URL
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "25");
  const sortColumn = searchParams.get("sortColumn") || "created_at";
  const sortDirection = searchParams.get("sortDirection") || "desc";
  const year = searchParams.get("year");
  const fromDate = searchParams.get("fromDate");
  const toDate = searchParams.get("toDate");
  const all = searchParams.get("all") === "true"; // Fetch all records without pagination

  const offset = (page - 1) * limit;

  const transactionsCollection = await getCollection(COLLECTIONS.TRANSACTIONS);

  const filter: Record<string, unknown> = { user_id: toObjectId(user.id) };

  // Date range filter (takes precedence over year filter)
  if (fromDate && toDate) {
    const startDate = new Date(fromDate + "T00:00:00.000Z");
    const endDate = new Date(toDate + "T23:59:59.999Z");
    filter.created_at = { $gte: startDate, $lte: endDate };
  } else if (year) {
    const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);
    const endOfYear = new Date(`${year}-12-31T23:59:59.999Z`);
    filter.created_at = { $gte: startOfYear, $lte: endOfYear };
  }

  const count = await transactionsCollection.countDocuments(filter);

  // Get data with or without pagination
  let data;
  if (all) {
    // Fetch all records without pagination
    data = await transactionsCollection
      .find(filter)
      .sort({ [sortColumn]: sortDirection === "asc" ? 1 : -1 })
      .toArray();
  } else {
    // Get paginated and sorted data
    data = await transactionsCollection
      .find(filter)
      .sort({ [sortColumn]: sortDirection === "asc" ? 1 : -1 })
      .skip(offset)
      .limit(limit)
      .toArray();
  }

  // Convert _id to id
  const transactions = data.map((transaction) => ({
    ...transaction,
    id: transaction._id.toString(),
    _id: undefined,
    user_id: transaction.user_id.toString(),
  }));

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

  const newTransaction = await request.json();

  const transactionsCollection = await getCollection(COLLECTIONS.TRANSACTIONS);
  const result = await transactionsCollection.insertOne({
    ...newTransaction,
    user_id: toObjectId(user.id),
    created_at: newTransaction.created_at
      ? new Date(newTransaction.created_at)
      : new Date(),
  });

  if (!result.insertedId) {
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }

  const transaction = await transactionsCollection.findOne({
    _id: result.insertedId,
  });

  return NextResponse.json({
    ...transaction,
    id: transaction?._id.toString(),
    _id: undefined,
    user_id: transaction?.user_id.toString(),
  });
}
