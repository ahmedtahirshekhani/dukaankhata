import { getCollection, COLLECTIONS } from '@/lib/db/mongodb';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Quick ping to MongoDB to ensure backend has internet / DB access
    const dbCol = await getCollection(COLLECTIONS.USERS);
    await dbCol.findOne({}, { projection: { _id: 1 } });
    
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Database unreachable' }, { status: 503 });
  }
}
