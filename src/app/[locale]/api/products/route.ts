
// src/app/[locale]/api/products/route.ts
import { getCollection, COLLECTIONS, toObjectId, setLastUpdated, updateUserLastActivity } from '@/lib/db/mongodb'
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/utils'
import { requirePermission } from "@/lib/auth/rbac";

export async function GET(request: Request) {
  const user = await getCurrentUser() as { id: string } | null
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await requirePermission("products.view");

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const page = parseInt(searchParams.get("page") || "1");
  const limitParam = searchParams.get("limit");
  const limit = limitParam === "-1" ? 0 : parseInt(limitParam || "10");
  const search = searchParams.get("search") || "";
  const skip = limit > 0 ? (page - 1) * limit : 0;

  const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
  
  const query: any = { user_id: toObjectId(user.id) };
  if (type && type !== 'all') {
    query.type = type;
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { sku: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { category: { $regex: search, $options: "i" } },
    ];
  }

  const totalCount = await productsCollection.countDocuments(query);
  const totalPages = limit > 0 ? Math.ceil(totalCount / limit) : 1;

  const data = await productsCollection
    .find(query)
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  // Convert _id to id for consistency
  const products = data.map(product => ({
    ...product,
    id: product._id.toString(),
    _id: undefined,
  }));

  await updateUserLastActivity();
  return NextResponse.json({
    products,
    totalCount,
    totalPages,
    currentPage: page
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser() as { id: string } | null
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await requirePermission("products.create");

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

  await updateUserLastActivity();
  return NextResponse.json({
    ...product,
    id: product?._id.toString(),
    _id: undefined,
  })
}