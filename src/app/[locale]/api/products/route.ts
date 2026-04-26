// // src/app/[locale]/api/products/route.ts
// import { getCollection, COLLECTIONS, toObjectId } from '@/lib/db/mongodb'
// import { NextResponse } from 'next/server'
// import { getCurrentUser } from '@/lib/auth/utils'

// export async function GET(request: Request) {
//   const user = await getCurrentUser() as { id: string } | null
  
//   if (!user) {
//     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
//   }

//   const { searchParams } = new URL(request.url);
//   const type = searchParams.get('type');

//   const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
  
//   const query: any = { user_id: toObjectId(user.id) };
//   if (type && type !== 'all') {
//     query.type = type;
//   }

//   const data = await productsCollection
//     .find(query)
//     .toArray();

//   // Convert _id to id for consistency
//   const products = data.map(product => ({
//     ...product,
//     id: product._id.toString(),
//     _id: undefined,
//   }));

//   return NextResponse.json(products)
// }

// export async function POST(request: Request) {
//   const user = await getCurrentUser() as { id: string } | null
  
//   if (!user) {
//     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
//   }

//   const newProduct = await request.json();

//   const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
//   const result = await productsCollection.insertOne({
//     ...newProduct,
//     user_id: toObjectId(user.id),
//   });

//   if (!result.insertedId) {
//     return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
//   }

//   const product = await productsCollection.findOne({ _id: result.insertedId });

//   return NextResponse.json({
//     ...product,
//     id: product?._id.toString(),
//     _id: undefined,
//   })
// }







// src/app/[locale]/api/products/route.ts
import { getCollection, COLLECTIONS, toObjectId, setLastUpdated } from '@/lib/db/mongodb'
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/utils'

export async function GET(request: Request) {
  const user = await getCurrentUser() as { id: string } | null
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
  
  const query: any = { user_id: toObjectId(user.id) };
  if (type && type !== 'all') {
    query.type = type;
  }

  const data = await productsCollection
    .find(query)
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
  const now = new Date();

  const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
  const result = await productsCollection.insertOne({
    ...newProduct,
    user_id: toObjectId(user.id),
    created_at: now,
    updated_at: now,
  });

  if (!result.insertedId) {
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }

  // ✅ Update user's last activity
  const usersCollection = await getCollection(COLLECTIONS.USERS);
  await setLastUpdated(usersCollection, { _id: toObjectId(user.id) });

  const product = await productsCollection.findOne({ _id: result.insertedId });

  return NextResponse.json({
    ...product,
    id: product?._id.toString(),
    _id: undefined,
  })
}