import { getCollection, COLLECTIONS, toObjectId, isValidObjectId } from '@/lib/db/mongodb'
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/utils'

export async function PUT(
  request: Request,
  { params }: { params: { transactionId: string } }
) {
  const user = await getCurrentUser() as { id: string } | null
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const updatedTransaction = await request.json();
  const transactionId = params.transactionId;

  if (!isValidObjectId(transactionId)) {
    return NextResponse.json({ error: 'Invalid transaction ID' }, { status: 400 })
  }

  const transactionsCollection = await getCollection(COLLECTIONS.TRANSACTIONS);
  const result = await transactionsCollection.findOneAndUpdate(
    {
      _id: toObjectId(transactionId),
      user_id: toObjectId(user.id)
    },
    {
      $set: {
        ...updatedTransaction,
        amount: Number(updatedTransaction.amount),
        created_at: new Date(updatedTransaction.created_at),
        user_id: toObjectId(user.id)
      }
    },
    { returnDocument: 'after' }
  );

  if (!result) {
    return NextResponse.json({ error: 'Transaction not found or not authorized' }, { status: 404 })
  }

  return NextResponse.json({
    ...result,
    id: result._id.toString(),
    _id: undefined,
    user_id: result.user_id.toString()
  })
}

export async function DELETE(
  request: Request,
  { params }: { params: { transactionId: string } }
) {
  const user = await getCurrentUser() as { id: string } | null
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const transactionId = params.transactionId;

  if (!isValidObjectId(transactionId)) {
    return NextResponse.json({ error: 'Invalid transaction ID' }, { status: 400 })
  }

  const transactionsCollection = await getCollection(COLLECTIONS.TRANSACTIONS);
  const result = await transactionsCollection.deleteOne({
    _id: toObjectId(transactionId),
    user_id: toObjectId(user.id)
  });

  if (result.deletedCount === 0) {
    return NextResponse.json({ error: 'Transaction not found or not authorized' }, { status: 404 })
  }

  return NextResponse.json({ message: 'Transaction deleted successfully' })
}
