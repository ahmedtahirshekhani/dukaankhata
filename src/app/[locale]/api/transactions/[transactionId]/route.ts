
// src/app/[locale]/api/transactions/[transactionId]/route.ts
import { getCollection, COLLECTIONS, toObjectId, isValidObjectId, setLastUpdated, updateUserLastActivity } from '@/lib/db/mongodb'
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/utils'
import { requireAnyPermission } from "@/lib/auth/rbac";

export async function PUT(
  request: Request,
  { params }: { params: { transactionId: string } }
) {
  const user = await getCurrentUser() as { id: string } | null
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const authCheck = await requireAnyPermission([
    "sales.edit_payment_in", 
    "purchase.edit_payment_out", 
    "expenses.edit"
  ]);
  if (!authCheck.allowed) return authCheck.response!;

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

  // Fetch old transaction for stock adjustment
  const oldTransaction = await transactionsCollection.findOne(filter);

  // ✅ Use setLastUpdated helper
  const updateResult = await setLastUpdated(transactionsCollection, filter, updateData);

  if (updateResult.matchedCount === 0) {
    return NextResponse.json({ error: 'Transaction not found or not authorized' }, { status: 404 })
  }

  // Handle stock adjustment for counter sale
  if (oldTransaction && updatedTransaction.productId && updatedTransaction.productId !== "0" && updatedTransaction.quantity !== undefined) {
    const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
    const prodIdStr = String(updatedTransaction.productId);
    if (prodIdStr.match(/^[0-9a-fA-F]{24}$/)) {
      let incVal = 0;
      // Revert old transaction effect
      if (oldTransaction.type === "income") incVal += (Number(oldTransaction.quantity) || 0);
      else incVal -= (Number(oldTransaction.quantity) || 0);
      
      // Apply new transaction effect
      if (updatedTransaction.type === "income") incVal -= (Number(updatedTransaction.quantity) || 0);
      else incVal += (Number(updatedTransaction.quantity) || 0);
      
      if (incVal !== 0) {
        const product = await productsCollection.findOne({ _id: toObjectId(prodIdStr), user_id: toObjectId(user.id) });
        if (product) {
          const currentQty = Number(product.quantity) || 0;
          const newQty = currentQty + incVal;
          await productsCollection.updateOne(
            { _id: toObjectId(prodIdStr), user_id: toObjectId(user.id) },
            { 
              $set: { 
                quantity: newQty,
                quantity_str: newQty.toString(),
                updated_at: new Date()
              }
            }
          );
        }
      }
    }
  }

  // Fetch updated document
  const updatedDoc = await transactionsCollection.findOne(filter);
  if (!updatedDoc) {
    return NextResponse.json({ error: 'Transaction not found after update' }, { status: 404 })
  }

  // ✅ Update user's last activity
  const usersCollection = await getCollection(COLLECTIONS.USERS);
  await setLastUpdated(usersCollection, { _id: toObjectId(user.id) });

  await updateUserLastActivity();
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

  const authCheck = await requireAnyPermission([
    "sales.delete_payment_in", 
    "purchase.delete_payment_out", 
    "expenses.delete"
  ]);
  if (!authCheck.allowed) return authCheck.response!;

  const transactionId = params.transactionId;

  if (!isValidObjectId(transactionId)) {
    return NextResponse.json({ error: 'Invalid transaction ID' }, { status: 400 })
  }

  const transactionsCollection = await getCollection(COLLECTIONS.TRANSACTIONS);
  const filter = {
    _id: toObjectId(transactionId),
    user_id: toObjectId(user.id)
  };

  const transactionToDelete = await transactionsCollection.findOne(filter);

  const result = await transactionsCollection.deleteOne(filter);

  if (result.deletedCount === 0) {
    return NextResponse.json({ error: 'Transaction not found or not authorized' }, { status: 404 })
  }

  // Handle stock reversion for counter sale
  if (transactionToDelete && transactionToDelete.productId && transactionToDelete.productId !== "0" && transactionToDelete.quantity) {
    const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
    const prodIdStr = String(transactionToDelete.productId);
    if (prodIdStr.match(/^[0-9a-fA-F]{24}$/)) {
      const qtyNum = Number(transactionToDelete.quantity) || 0;
      const incVal = transactionToDelete.type === "income" ? qtyNum : -qtyNum;
      if (incVal !== 0) {
        const product = await productsCollection.findOne({ _id: toObjectId(prodIdStr), user_id: toObjectId(user.id) });
        if (product) {
          const currentQty = Number(product.quantity) || 0;
          const newQty = currentQty + incVal;
          await productsCollection.updateOne(
            { _id: toObjectId(prodIdStr), user_id: toObjectId(user.id) },
            { 
              $set: { 
                quantity: newQty,
                quantity_str: newQty.toString(),
                updated_at: new Date()
              }
            }
          );
        }
      }
    }
  }

  // ✅ Update user's last activity after deletion
  const usersCollection = await getCollection(COLLECTIONS.USERS);
  await setLastUpdated(usersCollection, { _id: toObjectId(user.id) });

  await updateUserLastActivity();
  return NextResponse.json({ message: 'Transaction deleted successfully' });
}