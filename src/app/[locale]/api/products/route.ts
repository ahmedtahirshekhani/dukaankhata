
import { getCollection, COLLECTIONS, toObjectId } from '@/lib/mongodb'
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-utils'

export async function GET(request: Request) {
  const user = await getCurrentUser() as { id: string } | null
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
  const data = await productsCollection
    .find({ user_id: toObjectId(user.id) })
    .toArray();

  // Convert _id to id for consistency
  const products = data.map(product => ({
    ...product,
    id: product._id.toString(),
    _id: undefined,
  }));

  return NextResponse.json(products)
}

export async function POST(request: Request) {
  const user = await getCurrentUser() as { id: string } | null
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const newProduct = await request.json();

  const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
  const result = await productsCollection.insertOne({
    ...newProduct,
    user_id: toObjectId(user.id),
  });

  if (!result.insertedId) {
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }

  const product = await productsCollection.findOne({ _id: result.insertedId });

  return NextResponse.json({
    ...product,
    id: product?._id.toString(),
    _id: undefined,
  })
}
