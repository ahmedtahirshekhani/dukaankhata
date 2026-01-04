import { getCollection, COLLECTIONS, toObjectId } from '@/lib/mongodb'
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-utils'

export async function GET(request: Request) {
  const user = await getCurrentUser() as { id: string } | null
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get pagination and sort parameters from URL
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '25');
  const sortColumn = searchParams.get('sortColumn') || 'created_at';
  const sortDirection = searchParams.get('sortDirection') || 'desc';
  const year = searchParams.get('year');
  
  const offset = (page - 1) * limit;

  const transactionsCollection = await getCollection(COLLECTIONS.TRANSACTIONS);

  const filter: Record<string, unknown> = { user_id: toObjectId(user.id) };

  if (year) {
    const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);
    const endOfYear = new Date(`${year}-12-31T23:59:59.999Z`);
    filter.created_at = { $gte: startOfYear, $lte: endOfYear };
  }

  const count = await transactionsCollection.countDocuments(filter);

  // Get paginated and sorted data
  const data = await transactionsCollection
    .find(filter)
    .sort({ [sortColumn]: sortDirection === 'asc' ? 1 : -1 })
    .skip(offset)
    .limit(limit)
    .toArray();

  // Convert _id to id
  const transactions = data.map(transaction => ({
    ...transaction,
    id: transaction._id.toString(),
    _id: undefined,
    user_id: transaction.user_id.toString(),
    order_id: transaction.order_id?.toString(),
    payment_method_id: transaction.payment_method_id?.toString(),
  }));

  return NextResponse.json({
    data: transactions,
    total: count,
    page,
    limit,
    totalPages: Math.ceil(count / limit)
  })
}

export async function POST(request: Request) {
  const user = await getCurrentUser() as { id: string } | null
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const newTransaction = await request.json();

  const transactionsCollection = await getCollection(COLLECTIONS.TRANSACTIONS);
  const result = await transactionsCollection.insertOne({
    ...newTransaction,
    user_id: toObjectId(user.id),
    order_id: newTransaction.order_id ? toObjectId(newTransaction.order_id) : undefined,
    payment_method_id: newTransaction.payment_method_id ? toObjectId(newTransaction.payment_method_id) : undefined,
    created_at: newTransaction.created_at ? new Date(newTransaction.created_at) : new Date(),
  });

  if (!result.insertedId) {
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 })
  }

  const transaction = await transactionsCollection.findOne({ _id: result.insertedId });

  return NextResponse.json({
    ...transaction,
    id: transaction?._id.toString(),
    _id: undefined,
    user_id: transaction?.user_id.toString(),
    order_id: transaction?.order_id?.toString(),
    payment_method_id: transaction?.payment_method_id?.toString(),
  })
}
