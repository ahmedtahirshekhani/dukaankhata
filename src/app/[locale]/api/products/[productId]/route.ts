// src/app/[locale]/api/products/[productId]/route.ts
import { getCollection, COLLECTIONS, toObjectId, isValidObjectId, setLastUpdated, updateUserLastActivity } from '@/lib/db/mongodb'
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/utils'

export async function GET(
  request: Request,
  { params }: { params: { productId: string } }
) {
  const user = await getCurrentUser() as { id: string } | null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  let updatedProduct: Record<string, unknown> = {}
  try {
    updatedProduct = await request.json()
  } catch (parseErr) {
    console.error('[PUT /api/products/:productId] Failed to parse request body', {
      requestId,
      userId: user.id,
      params,
      error: parseErr instanceof Error ? parseErr.message : String(parseErr),
    })
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const productId = params.productId

  if (!isValidObjectId(productId)) {
    return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 })
  }

  try {
    const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
    const filter = { 
      _id: toObjectId(productId),
      user_id: toObjectId(user.id)
    };

    const updateResult = await productsCollection.updateOne(filter, { $set: updatedProduct });

    if (updateResult.matchedCount === 0) {
      console.warn('[PUT /api/products/:productId] Product not found or not authorized', {
        requestId,
        userId: user.id,
        productId,
      })
      return NextResponse.json({ error: 'Product not found or not authorized' }, { status: 404 })
    }

    // Fetch updated document
    const updatedDoc = await productsCollection.findOne(filter);
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