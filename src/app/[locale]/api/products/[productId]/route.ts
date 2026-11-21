// src/app/[locale]/api/products/[productId]/route.ts
import { getCollection, COLLECTIONS, toObjectId, isValidObjectId, setLastUpdated, updateUserLastActivity } from '@/lib/db/mongodb'
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/utils'
import { requirePermission } from "@/lib/auth/rbac";

export async function GET(
  request: Request,
  { params }: { params: { productId: string } }
) {
  const user = await getCurrentUser() as { id: string } | null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const authCheck = await requirePermission("products.view");
  if (!authCheck.allowed) return authCheck.response!;

  const productId = params.productId
  if (!isValidObjectId(productId)) return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 })

  const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
  const product = await productsCollection.findOne({
    _id: toObjectId(productId),
    user_id: toObjectId(user.id)
  });

  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  await updateUserLastActivity();
  return NextResponse.json({
    ...product,
    id: product._id.toString(),
    _id: undefined
  })
}

export async function PUT(
  request: Request,
  { params }: { params: { productId: string } }
) {
  const user = await getCurrentUser() as { id: string } | null

  const requestId = crypto.randomUUID?.() || `${Date.now()}`

  if (!user) {
    console.warn('[PUT /api/products/:productId] Unauthorized', { requestId, params })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const authCheck = await requirePermission("products.edit");
  if (!authCheck.allowed) return authCheck.response!;

  let updatedProduct: Record<string, unknown> = {}
  try {
    updatedProduct = await request.json()
  } catch (parseErr) {
    const errorMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
    if (errorMsg === 'aborted' || errorMsg.includes('aborted')) {
      console.warn(`[PUT /api/products/:productId] Request aborted by client (${requestId})`);
    } else {
      console.error('[PUT /api/products/:productId] Failed to parse request body', {
        requestId,
        userId: user.id,
        params,
        error: errorMsg,
      });
    }
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const productId = params.productId

  if (!isValidObjectId(productId)) {
    return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 })
  }

  try {
    delete updatedProduct.id;
    delete updatedProduct._id;
    delete updatedProduct.user_id;
    delete updatedProduct.created_at;
    delete updatedProduct.updated_at;

    const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
    const filter = { 
      _id: toObjectId(productId),
      $or: [
        { user_id: toObjectId(user.id) },
        { user_id: user.id }
      ]
    };

    if (updatedProduct.quantity !== undefined && updatedProduct.in_stock === undefined) {
      updatedProduct.in_stock = updatedProduct.quantity;
    }

    const newCost = Number(updatedProduct.cost_price ?? updatedProduct.purchase_price);
    if (!isNaN(newCost) && newCost >= 0) {
      updatedProduct.cost_price = newCost;
      updatedProduct.purchase_price = newCost;
      updatedProduct.initial_cost = newCost;
    }

    const updateResult = await productsCollection.updateOne(filter, { 
      $set: {
        ...updatedProduct,
        updated_at: new Date()
      }
    });

    if (updateResult.matchedCount === 0) {
      console.warn('[PUT /api/products/:productId] Product not found or not authorized', {
        requestId,
        userId: user.id,
        productId,
      })
      return NextResponse.json({ error: 'Product not found or not authorized' }, { status: 404 })
    }

    // Synchronize opening stock batch in INVENTORY_BATCHES collection
    if (!isNaN(newCost) && newCost >= 0) {
      try {
        const batchesCollection = await getCollection(COLLECTIONS.INVENTORY_BATCHES);
        const prodObjId = toObjectId(productId);
        const batchFilter = {
          user_id: toObjectId(user.id),
          product_id: { $in: [prodObjId, productId] },
          $or: [
            { source_type: "opening_stock" },
            { batch_number: "OPENING" }
          ]
        };
        const updateBatchRes = await batchesCollection.updateMany(batchFilter, {
          $set: {
            cost_price: newCost,
            updated_at: new Date()
          }
        });

        // If no opening batch existed yet, but product had initial quantity, create it now
        if (updateBatchRes.matchedCount === 0) {
          const currentProd = await productsCollection.findOne({ _id: prodObjId });
          const initQty = Number((currentProd as any)?.initial_quantity ?? (currentProd as any)?.opening_stock ?? (currentProd as any)?.quantity) || 0;
          if (initQty > 0) {
            await batchesCollection.insertOne({
              user_id: toObjectId(user.id),
              product_id: prodObjId,
              source_type: "opening_stock",
              source_id: productId,
              batch_number: "OPENING",
              initial_quantity: initQty,
              remaining_quantity: initQty,
              cost_price: newCost,
              status: "active",
              batch_date: (currentProd as any)?.created_at || new Date(),
              created_at: (currentProd as any)?.created_at || new Date(),
              updated_at: new Date(),
            });
          }
        }
      } catch (batchErr) {
        console.error("Failed to update opening batch cost price on product edit:", batchErr);
      }
    }

    // Fetch updated document
    const updatedDoc = await productsCollection.findOne({ _id: toObjectId(productId) });
    if (!updatedDoc) {
      return NextResponse.json({ error: 'Product not found after update' }, { status: 404 })
    }

    console.info('[PUT /api/products/:productId] Product update succeeded', {
      requestId,
      userId: user.id,
      productId,
    })

    await updateUserLastActivity();
    return NextResponse.json({
      ...updatedDoc,
      id: updatedDoc._id.toString(),
      _id: undefined,
    })
  } catch (err) {
    console.error('[PUT /api/products/:productId] Unexpected error', {
      requestId,
      userId: user.id,
      productId,
      bodyKeys: Object.keys(updatedProduct || {}),
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { productId: string } }
) {
  const user = await getCurrentUser() as { id: string } | null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const authCheck = await requirePermission("products.delete");
  if (!authCheck.allowed) return authCheck.response!;

  const productId = params.productId
  if (!isValidObjectId(productId)) return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 })

  try {
    // Check if product has associated transactions
    const { checkProductHasTransactionsServer } = await import("@/lib/entity-checks/server");
    const checkResult = await checkProductHasTransactionsServer({
      userId: user.id,
      productId,
    });

    if (checkResult.hasTransactions) {
      return NextResponse.json(
        {
          error: "has_associated_transactions",
          message: `Cannot delete product because it has associated transactions (${checkResult.summary}).`,
          details: checkResult.details,
        },
        { status: 400 }
      );
    }

    const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
    const result = await productsCollection.deleteOne({
      _id: toObjectId(productId),
      user_id: toObjectId(user.id)
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Product not found or not authorized' }, { status: 404 })
    }

    await updateUserLastActivity();
    return NextResponse.json({ message: 'Product deleted successfully' })
  } catch (err) {
    console.error('[DELETE /api/products/:productId] Unexpected error', {
      userId: user.id,
      productId,
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}