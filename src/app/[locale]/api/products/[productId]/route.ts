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

    // Keep opening stock batch in sync with updated product quantity and cost
    if (updatedProduct.quantity !== undefined || updatedProduct.cost_price !== undefined || updatedProduct.purchase_price !== undefined) {
      try {
        const batchesCollection = await getCollection(COLLECTIONS.INVENTORY_BATCHES);
        const openingBatch = await batchesCollection.findOne({
          user_id: toObjectId(user.id),
          product_id: { $in: [toObjectId(productId), productId] },
          $or: [
            { source_type: "opening_stock" },
            { batch_number: "OPENING" }
          ]
        });

        const newCost = updatedProduct.cost_price !== undefined 
          ? Number(updatedProduct.cost_price) 
          : (updatedProduct.purchase_price !== undefined ? Number(updatedProduct.purchase_price) : undefined);
        const newQty = updatedProduct.quantity !== undefined ? Number(updatedProduct.quantity) : undefined;

        if (openingBatch) {
          const updateBatchFields: Record<string, any> = {
            updated_at: new Date()
          };
          if (newCost !== undefined && !isNaN(newCost)) {
            updateBatchFields.cost_price = newCost;
          }
          if (newQty !== undefined && !isNaN(newQty)) {
            const oldInitialQty = Number(openingBatch.initial_quantity) || 0;
            const oldRemainingQty = Number(openingBatch.remaining_quantity) || 0;
            const consumed = Math.max(0, oldInitialQty - oldRemainingQty);
            updateBatchFields.initial_quantity = newQty;
            updateBatchFields.remaining_quantity = Math.max(0, newQty - consumed);
          }
          await batchesCollection.updateOne(
            { _id: openingBatch._id },
            { $set: updateBatchFields }
          );
        } else if (newQty !== undefined && newQty > 0) {
          await batchesCollection.insertOne({
            user_id: toObjectId(user.id),
            product_id: toObjectId(productId),
            source_type: "opening_stock",
            source_id: productId,
            batch_number: "OPENING",
            initial_quantity: newQty,
            remaining_quantity: newQty,
            cost_price: newCost || 0,
            status: "active",
            batch_date: new Date(),
            created_at: new Date(),
            updated_at: new Date(),
          });
        }
      } catch (batchErr) {
        console.error('[PUT /api/products/:productId] Failed to sync opening batch:', batchErr);
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