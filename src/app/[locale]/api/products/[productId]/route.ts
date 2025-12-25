import { getCollection, COLLECTIONS, toObjectId, isValidObjectId } from '@/lib/mongodb'
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-utils'

export async function PUT(
  request: Request,
  { params }: { params: { productId: string } }
) {
  const user = await getCurrentUser() as { id: string } | null

  // Basic context for all logs
  const requestId = crypto.randomUUID?.() || `${Date.now()}`

  if (!user) {
    console.warn('[PUT /api/products/:productId] Unauthorized', {
      requestId,
      params,
    })
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
    const result = await productsCollection.findOneAndUpdate(
      { 
        _id: toObjectId(productId),
        user_id: toObjectId(user.id)
      },
      { 
        $set: { 
          ...updatedProduct,
          user_id: toObjectId(user.id)
        } 
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      console.warn('[PUT /api/products/:productId] Product not found or not authorized', {
        requestId,
        userId: user.id,
        productId,
      })
      return NextResponse.json({ error: 'Product not found or not authorized' }, { status: 404 })
    }

    console.info('[PUT /api/products/:productId] Product update succeeded', {
      requestId,
      userId: user.id,
      productId,
    })

    return NextResponse.json({
      ...result,
      id: result._id.toString(),
      _id: undefined,
    })
  } catch (err) {
    // Catch-all unexpected errors
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
