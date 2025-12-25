import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCollection, COLLECTIONS, toObjectId } from '@/lib/mongodb';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = await getCollection(COLLECTIONS.USERS);
    const userId = (session.user as any).id as string;
    const user = await users.findOne({ _id: toObjectId(userId) }, { projection: { company_logo: 1, signature_image: 1 } });

    return NextResponse.json({
      ok: true,
      companyLogo: user?.company_logo || null,
      signatureImage: user?.signature_image || null,
    });
  } catch (err: any) {
    console.error('config assets GET error', err?.message || err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { companyLogo, signatureImage } = body || {};

    const update: Record<string, any> = { updated_at: new Date() };
    if (typeof companyLogo === 'string') update.company_logo = companyLogo;
    if (typeof signatureImage === 'string') update.signature_image = signatureImage;

    const users = await getCollection(COLLECTIONS.USERS);
    const userId = (session.user as any).id as string;

    const result = await users.updateOne({ _id: toObjectId(userId) }, { $set: update });
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('config assets POST error', err?.message || err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
