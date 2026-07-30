
import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS, toObjectId, setLastUpdated } from "@/lib/db/mongodb";
import { getCurrentUser } from "@/lib/auth/utils";
import { requirePermission } from "@/lib/auth/rbac";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requirePermission("sales.view_quotations");
    if (!authCheck.allowed) return authCheck.response!;

    const { id } = await params;
    const { design_id = 1 } = await request.json();

    const quotationsCollection = await getCollection(COLLECTIONS.QUOTATIONS);
    const quotation = await quotationsCollection.findOne({
      _id: toObjectId(id),
      user_id: toObjectId(user.id),
    });

    if (!quotation) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    }

    // ✅ (Optional) Update user's last activity even for download – shows user activity
    // If you don't want to record downloads, you can remove this block.
    const usersCollection = await getCollection(COLLECTIONS.USERS);
    await setLastUpdated(usersCollection, { _id: toObjectId(user.id) });

    // Generate PDF (placeholder)
    const pdfContent = generatePDFContent(quotation, design_id);
    const pdfBlob = new Blob([new Uint8Array(pdfContent)], { type: 'application/pdf' });

    return new NextResponse(pdfBlob, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Quotation-${quotation.party_name}-${id}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      { error: "Failed to download quotation" },
      { status: 500 }
    );
  }
}

function generatePDFContent(quotation: any, designId: number): Buffer {
  // This is a placeholder - in production, use a real PDF library
  const designs: { [key: number]: string } = {
    1: "Design 1: Professional",
    2: "Design 2: Modern",
    3: "Design 3: Simple",
    4: "Design 4: Detailed",
    5: "Design 5: Standard",
  };

  console.log(`Generating PDF with ${designs[designId]} for quotation ${quotation._id}`);
  // Return mock PDF header (in production use real PDF generation)
  return Buffer.from("%PDF-1.4\n");
}