//api/quotations/:id - Get, update, delete single quotation
import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS, toObjectId, isValidObjectId } from "@/lib/db/mongodb";
import { getCurrentUser } from "@/lib/auth/utils";
import type { QuotationDoc } from "../route";

// // GET single quotation
// export async function GET(
//   request: NextRequest,
//   { params }: { params: Promise<{ id: string }> | { id: string } }
// ) {
//   try {
//     const user = await getCurrentUser();
//     if (!user) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     // Handle both sync and async params (Next.js 15+)
//     const { id } = await params;

//     if (!id || !isValidObjectId(id)) {
//       return NextResponse.json({ error: "Invalid quotation ID" }, { status: 400 });
//     }

//     const quotationsCollection = await getCollection<QuotationDoc>(COLLECTIONS.QUOTATIONS);
//     const quotation = await quotationsCollection.findOne({
//       _id: toObjectId(id),
//       user_id: toObjectId(user.id),
//     });

//     if (!quotation) {
//       return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
//     }

//     // Format response (convert ObjectIds to strings)
//     const formatted = {
//       _id: quotation._id?.toString(),
//       user_id: quotation.user_id?.toString(),
//       party_id: quotation.party_id?.toString(),
//       party_name: quotation.party_name,
//       items: (quotation.items || []).map((item: any) => ({
//         ...item,
//         product_id: item.product_id?.toString(),
//       })),
//       discount: quotation.discount || 0,
//       discount_type: quotation.discount_type || "fixed",
//       tax: quotation.tax || 0,
//       tax_type: quotation.tax_type || "fixed",
//       total_amount: quotation.total_amount || 0,
//       validity_date: quotation.validity_date,
//       notes: quotation.notes || "",
//       status: quotation.status || "open",
//       created_at: quotation.created_at,
//       updated_at: quotation.updated_at,
//     };

//     return NextResponse.json(formatted);
//   } catch (error: any) {
//     console.error("GET /api/quotations/[id] error:", error);
//     return NextResponse.json(
//       { error: "Failed to fetch quotation", details: error.message },
//       { status: 500 }
//     );
//   }
// }

// GET single quotation (including company info)
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> | { id: string } }
) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        if (!id || !isValidObjectId(id)) {
            return NextResponse.json({ error: "Invalid quotation ID" }, { status: 400 });
        }

        const quotationsCollection = await getCollection<QuotationDoc>(COLLECTIONS.QUOTATIONS);
        const usersCollection = await getCollection(COLLECTIONS.USERS);

        // Fetch quotation
        const quotation = await quotationsCollection.findOne({
            _id: toObjectId(id),
            user_id: toObjectId(user.id),
        });

        if (!quotation) {
            return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
        }

        // Fetch company info from users collection
        const userDoc = await usersCollection.findOne(
            { _id: toObjectId(user.id) },
            { projection: { company_name: 1, company_address: 1, company_logo: 1, signature_image: 1 } }
        );

        // Format quotation response
        const formatted = {
            _id: quotation._id?.toString(),
            user_id: quotation.user_id?.toString(),
            party_id: quotation.party_id?.toString(),
            party_name: quotation.party_name,
            items: (quotation.items || []).map((item: any) => ({
                ...item,
                product_id: item.product_id?.toString(),
            })),
            discount: quotation.discount || 0,
            discount_type: quotation.discount_type || "fixed",
            tax: quotation.tax || 0,
            tax_type: quotation.tax_type || "fixed",
            total_amount: quotation.total_amount || 0,
            validity_date: quotation.validity_date,
            notes: quotation.notes || "",
            status: quotation.status || "open",
            created_at: quotation.created_at,
            updated_at: quotation.updated_at,
            // Add company details
            company: {
                name: userDoc?.company_name || "Your Company Name",
                address: userDoc?.company_address || "",
                logo: userDoc?.company_logo || null,
                signatureImage: userDoc?.signature_image || null,  // 👈 signature image added
            },
        };

        return NextResponse.json(formatted);
    } catch (error: any) {
        console.error("GET /api/quotations/[id] error:", error);
        return NextResponse.json(
            { error: "Failed to fetch quotation", details: error.message },
            { status: 500 }
        );
    }
}

// PUT update quotation
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> | { id: string } }
) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        if (!id || !isValidObjectId(id)) {
            return NextResponse.json({ error: "Invalid quotation ID" }, { status: 400 });
        }

        const data = await request.json();

        // Remove id and status from data if present
        const { id: _, _id, status: _status, ...updateData } = data;

        // Always keep party_id as ObjectId
        if (updateData.party_id) updateData.party_id = toObjectId(updateData.party_id);
        // Always keep items[].product_id as ObjectId
        if (Array.isArray(updateData.items)) {
            updateData.items = updateData.items.map((item: any) => ({
                ...item,
                product_id: toObjectId(item.product_id),
            }));
        }

        const quotationsCollection = await getCollection<QuotationDoc>(COLLECTIONS.QUOTATIONS);

        const result = await quotationsCollection.findOneAndUpdate(
            { _id: toObjectId(id), user_id: toObjectId(user.id) },
            {
                $set: {
                    ...updateData,
                    updated_at: new Date().toISOString(),
                    // Never change status on edit, keep as is
                },
            },
            { returnDocument: "after" }
        );

        if (!result) {
            return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
        }

        const updated = result;
        const formatted = {
            _id: updated._id?.toString(),
            user_id: updated.user_id?.toString(),
            party_id: updated.party_id?.toString(),
            party_name: updated.party_name,
            items: (updated.items || []).map((item: any) => ({
                ...item,
                product_id: item.product_id?.toString(),
            })),
            discount: updated.discount || 0,
            discount_type: updated.discount_type || "fixed",
            tax: updated.tax || 0,
            tax_type: updated.tax_type || "fixed",
            total_amount: updated.total_amount || 0,
            validity_date: updated.validity_date,
            notes: updated.notes || "",
            status: updated.status || "open",
            created_at: updated.created_at,
            updated_at: updated.updated_at,
        };

        return NextResponse.json(formatted);
    } catch (error: any) {
        console.error("PUT /api/quotations/[id] error:", error);
        return NextResponse.json(
            { error: "Failed to update quotation", details: error.message },
            { status: 500 }
        );
    }
}

// DELETE quotation (soft delete - set status to cancelled)
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> | { id: string } }
) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        if (!id || !isValidObjectId(id)) {
            return NextResponse.json({ error: "Invalid quotation ID" }, { status: 400 });
        }

        const quotationsCollection = await getCollection<QuotationDoc>(COLLECTIONS.QUOTATIONS);

        const result = await quotationsCollection.findOneAndUpdate(
            { _id: toObjectId(id), user_id: toObjectId(user.id) },
            {
                $set: {
                    status: "cancelled",
                    updated_at: new Date().toISOString(),
                },
            },
            { returnDocument: "after" }
        );

        if (!result) {
            return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            message: "Quotation cancelled successfully",
            quotation: {
                _id: result._id?.toString(),
                status: result.status,
            },
        });
    } catch (error: any) {
        console.error("DELETE /api/quotations/[id] error:", error);
        return NextResponse.json(
            { error: "Failed to delete quotation", details: error.message },
            { status: 500 }
        );
    }
}