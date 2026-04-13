import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await connectToDatabase();
    const { id } = params;
    const { design_id = 1 } = await request.json();

    // Fetch quotation
    const quotation = await db
      .collection("quotations")
      .findOne({
        _id: id,
        user_id: session.user.id,
      });

    if (!quotation) {
      return NextResponse.json(
        { error: "Quotation not found" },
        { status: 404 }
      );
    }

    // Generate PDF based on design_id
    // For now, return a mock PDF blob
    // In production, use libraries like puppeteer or html2pdf

    const pdfContent = generatePDFContent(quotation, design_id);

    return new NextResponse(pdfContent, {
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
  // For now, return empty buffer that would normally be a PDF
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
