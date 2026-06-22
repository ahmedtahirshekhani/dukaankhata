import { NextResponse } from 'next/server';
import { getCollection, COLLECTIONS, toObjectId } from '@/lib/db/mongodb';
import { getCurrentUser } from '@/lib/auth/utils';

export async function GET(request: Request) {
  const user = (await getCurrentUser()) as { id: string } | null;
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const customersColl = await getCollection(COLLECTIONS.CUSTOMERS);
    const customers = await customersColl
      .find({ user_id: toObjectId(user.id), is_delete: { $ne: 1 } })
      .sort({ balance: -1 })
      .limit(10)
      .project({ _id: 1, name: 1, email: 1, phone: 1, balance: 1, status: 1 })
      .toArray();

    const data = customers.map((c) => ({
      id: c._id?.toString(),
      name: c.name ?? '-',
      email: c.email ?? '-',
      phone: c.phone ?? '-',
      balance: Number(c.balance ?? 0),
      status: c.status ?? 'active',
    }));

    return NextResponse.json({ customers: data, totalCount: data.length, totalPages: 1 });
  } catch (error) {
    console.error('Error fetching top customers:', error);
    return NextResponse.json({ error: 'Failed to fetch top customers' }, { status: 500 });
  }
}
