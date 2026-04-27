// // src/app/[locale]/api/transactions/[transactionId]/route.ts
// import { getCollection, COLLECTIONS, toObjectId, isValidObjectId } from '@/lib/db/mongodb'
// import { NextResponse } from 'next/server'
// import { getCurrentUser } from '@/lib/auth/utils'

// export async function PUT(
//   request: Request,
//   { params }: { params: { transactionId: string } }
// ) {
//   const user = await getCurrentUser() as { id: string } | null
  
//   if (!user) {
//     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
//   }

//   const updatedTransaction = await request.json();
//   const transactionId = params.transactionId;

//   if (!isValidObjectId(transactionId)) {
//     return NextResponse.json({ error: 'Invalid transaction ID' }, { status: 400 })
//   }

//   const transactionsCollection = await getCollection(COLLECTIONS.TRANSACTIONS);
//   const result = await transactionsCollection.findOneAndUpdate(
//     {
//       _id: toObjectId(transactionId),
//       user_id: toObjectId(user.id)
//     },
//     {
//       $set: {
//         ...updatedTransaction,
//         amount: Number(updatedTransaction.amount),
//         created_at: new Date(updatedTransaction.created_at),
//         user_id: toObjectId(user.id)
//       }
//     },
//     { returnDocument: 'after' }
//   );

//   if (!result) {
//     return NextResponse.json({ error: 'Transaction not found or not authorized' }, { status: 404 })
//   }

//   return NextResponse.json({
//     ...result,
//     id: result._id.toString(),
//     _id: undefined,
//     user_id: result.user_id.toString()
//   })
// }

// export async function DELETE(
//   request: Request,
//   { params }: { params: { transactionId: string } }
// ) {
//   const user = await getCurrentUser() as { id: string } | null
  
//   if (!user) {
//     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
//   }

//   const transactionId = params.transactionId;

//   if (!isValidObjectId(transactionId)) {
//     return NextResponse.json({ error: 'Invalid transaction ID' }, { status: 400 })
//   }

//   const transactionsCollection = await getCollection(COLLECTIONS.TRANSACTIONS);
//   const result = await transactionsCollection.deleteOne({
//     _id: toObjectId(transactionId),
//     user_id: toObjectId(user.id)
//   });

//   if (result.deletedCount === 0) {
//     return NextResponse.json({ error: 'Transaction not found or not authorized' }, { status: 404 })
//   }

//   return NextResponse.json({ message: 'Transaction deleted successfully' })
// }

// src/app/[locale]/api/transactions/[transactionId]/route.ts
import { getCollection, COLLECTIONS, toObjectId, isValidObjectId, setLastUpdated } from '@/lib/db/mongodb'
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
  const filter = {
    _id: toObjectId(transactionId),
    user_id: toObjectId(user.id)
  };

  // Prepare update data (without updated_at, helper will add it)
  const updateData = {
    ...updatedTransaction,
    amount: Number(updatedTransaction.amount),
    created_at: new Date(updatedTransaction.created_at),
    user_id: toObjectId(user.id)
  };

  // ✅ Use setLastUpdated helper
  const updateResult = await setLastUpdated(transactionsCollection, filter, updateData);

  if (updateResult.matchedCount === 0) {
    return NextResponse.json({ error: 'Transaction not found or not authorized' }, { status: 404 })
  }

  // Fetch updated document
  const updatedDoc = await transactionsCollection.findOne(filter);
  if (!updatedDoc) {
    return NextResponse.json({ error: 'Transaction not found after update' }, { status: 404 })
  }

  // ✅ Update user's last activity
  const usersCollection = await getCollection(COLLECTIONS.USERS);
  await setLastUpdated(usersCollection, { _id: toObjectId(user.id) });

  return NextResponse.json({
    ...updatedDoc,
    id: updatedDoc._id.toString(),
    _id: undefined,
    user_id: updatedDoc.user_id.toString()
  });
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

  // ✅ Update user's last activity after deletion
  const usersCollection = await getCollection(COLLECTIONS.USERS);
  await setLastUpdated(usersCollection, { _id: toObjectId(user.id) });

  return NextResponse.json({ message: 'Transaction deleted successfully' });
}