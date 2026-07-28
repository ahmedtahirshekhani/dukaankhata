import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCollection, COLLECTIONS, toObjectId, setLastUpdated } from "@/lib/db/mongodb";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const shops = await getCollection(COLLECTIONS.SHOPS);
    const shopId = (session.user as any).id as string;
    const shop = await shops.findOne(
      { _id: toObjectId(shopId) },
      { projection: { name: 1, company_logo: 1, signature_image: 1, company_address: 1, company_phone: 1, company_email: 1 } },
    );
    
    return NextResponse.json({
      ok: true,
      companyName: shop?.name || null,
      companyAddress: shop?.company_address || null,
      companyPhone: shop?.company_phone || null,
      companyEmail: shop?.company_email || null,
      companyLogo: shop?.company_logo || null,
      signatureImage: shop?.signature_image || null,
    });
  } catch (err: any) {
    console.error("config assets GET error", err?.message || err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { companyName, companyAddress, companyPhone, companyEmail, companyLogo, signatureImage } = body || {};

    const additionalUpdate: Record<string, any> = {};
    if (typeof companyName === "string") additionalUpdate.name = companyName.trim();
    if (typeof companyAddress === "string") additionalUpdate.company_address = companyAddress.trim();
    if (typeof companyPhone === "string") additionalUpdate.company_phone = companyPhone.trim();
    if (typeof companyEmail === "string") additionalUpdate.company_email = companyEmail.trim();
    if (typeof companyLogo === "string") additionalUpdate.company_logo = companyLogo;
    if (typeof signatureImage === "string") additionalUpdate.signature_image = signatureImage;

    const shops = await getCollection(COLLECTIONS.SHOPS);
    const shopId = (session.user as any).id as string;

    const result = await setLastUpdated(
      shops,
      { _id: toObjectId(shopId) },
      additionalUpdate
    );
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("config assets POST error", err?.message || err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
