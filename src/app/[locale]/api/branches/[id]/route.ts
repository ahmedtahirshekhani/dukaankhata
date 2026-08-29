import { getCollection, COLLECTIONS, toObjectId, updateUserLastActivity } from '@/lib/db/mongodb';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/utils';
import { requirePermission } from "@/lib/auth/rbac";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = (await getCurrentUser()) as { id: string } | null;
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authCheck = await requirePermission("settings.edit");
    if (!authCheck.allowed) return authCheck.response!;

    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: 'Branch ID is required' }, { status: 400 });
    }

    const branchesCollection = await getCollection(COLLECTIONS.BRANCHES);

    const result = await branchesCollection.deleteOne({
      _id: toObjectId(id),
      user_id: toObjectId(user.id),
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Branch not found or you do not have permission to delete it' },
        { status: 404 }
      );
    }

    await updateUserLastActivity();
    return NextResponse.json(
      { message: 'Branch deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting branch:', error);
    return NextResponse.json(
      { error: 'Failed to delete branch' },
      { status: 500 }
    );
  }
}
