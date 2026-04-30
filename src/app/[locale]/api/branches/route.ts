import { getCollection, COLLECTIONS, toObjectId, updateUserLastActivity } from '@/lib/db/mongodb';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/utils';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser() as { id: string } | null;
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const branchesCollection = await getCollection(COLLECTIONS.BRANCHES);
    const branches = await branchesCollection
      .find({ user_id: toObjectId(user.id) })
      .toArray();

    await updateUserLastActivity();
    return NextResponse.json(
      branches.map((branch) => ({
        id: branch._id?.toString(),
        name: branch.name,
      }))
    );
  } catch (error) {
    console.error('Error fetching branches:', error);
    return NextResponse.json({ error: 'Failed to fetch branches' }, { status: 500 });
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
      return NextResponse.json({ error: 'Invalid branch name' }, { status: 400 });
    }

    const branchesCollection = await getCollection(COLLECTIONS.BRANCHES);

    // Check if branch already exists for this user
    const existing = await branchesCollection.findOne({
      user_id: toObjectId(user.id),
      name: name.trim(),
    });

    if (existing) {
      await updateUserLastActivity();
      return NextResponse.json(
        {
          id: existing._id.toString(),
          name: existing.name,
        },
        { status: 200 }
      );
    }

    // Create new branch
    const result = await branchesCollection.insertOne({
      name: name.trim(),
      user_id: toObjectId(user.id),
      createdAt: new Date(),
    });

    await updateUserLastActivity();
    return NextResponse.json(
      {
        id: result.insertedId.toString(),
        name: name.trim(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating branch:', error);
    return NextResponse.json({ error: 'Failed to create branch' }, { status: 500 });
  }
}
