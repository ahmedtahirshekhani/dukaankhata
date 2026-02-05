import { getCollection, COLLECTIONS, toObjectId } from '@/lib/db/mongodb';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/utils';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser() as { id: string } | null;
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const categoriesCollection = await getCollection(COLLECTIONS.CATEGORIES);
    const categories = await categoriesCollection
      .find({ user_id: toObjectId(user.id) })
      .toArray();

    return NextResponse.json(
      categories.map((cat) => ({
        id: cat._id?.toString(),
        name: cat.name,
      }))
    );
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser() as { id: string } | null;
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Invalid category name' }, { status: 400 });
    }

    const categoriesCollection = await getCollection(COLLECTIONS.CATEGORIES);

    // Check if category already exists for this user
    const existing = await categoriesCollection.findOne({
      user_id: toObjectId(user.id),
      name: name.trim(),
    });

    if (existing) {
      return NextResponse.json(
        {
          id: existing._id.toString(),
          name: existing.name,
        },
        { status: 200 }
      );
    }

    // Create new category
    const result = await categoriesCollection.insertOne({
      name: name.trim(),
      user_id: toObjectId(user.id),
      createdAt: new Date(),
    });

    return NextResponse.json(
      {
        id: result.insertedId.toString(),
        name: name.trim(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating category:', error);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}
