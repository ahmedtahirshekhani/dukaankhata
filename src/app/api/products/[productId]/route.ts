import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-utils'

export async function PUT(
  request: Request,
  { params }: { params: { productId: string } }
) {
  const supabase = createClient();
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
  // NOTE: This route is for updating a product. There is no `orderId` segment in the route path,
  // and updating `orders` here caused 500s and schema mismatches.
  // We now only update the product record.

  try {
    const { data, error } = await supabase
      .from('products')
      .update({ ...updatedProduct, user_id: user.id })
      .eq('id', productId)
      .eq('user_id', user.id)
      .select()

    if (error) {
      console.error('[PUT /api/products/:productId] Product update failed', {
        requestId,
        userId: user.id,
        productId,
        error: error.message,
      })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
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

    return NextResponse.json(data[0])
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
