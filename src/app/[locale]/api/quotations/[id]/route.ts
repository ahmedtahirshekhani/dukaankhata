//api/quotations/:id - Get, update, delete single quotation
import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS, toObjectId, isValidObjectId, setLastUpdated, updateUserLastActivity } from "@/lib/db/mongodb";
import { getCurrentUser } from "@/lib/auth/utils";
import type { QuotationDoc } from "../route";

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
    const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);

    const quotation = await quotationsCollection.findOne({
      _id: toObjectId(id),
      user_id: toObjectId(user.id),
    });

    if (!quotation) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    }

    const userDoc = await usersCollection.findOne(
      { _id: toObjectId(user.id) },
      { projection: { company_name: 1, company_address: 1, company_logo: 1, signature_image: 1 } }
    );

    const customerDoc = await customersCollection.findOne(
      { _id: toObjectId(quotation.party_id) }
    );

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
      quotation_no: quotation.quotation_no || "",
      status: quotation.status || "open",
      created_at: quotation.created_at,
      updated_at: quotation.updated_at,
      company: {
        name: userDoc?.company_name || "Your Company Name",
        address: userDoc?.company_address || "",
        logo: userDoc?.company_logo || null,
        signatureImage: userDoc?.signature_image || null,
      },
      party_details: customerDoc ? {
        name: customerDoc.name,
        company_name: customerDoc.company_name,
        email: customerDoc.email,
        phone: customerDoc.phone,
        address: customerDoc.address,
        gstin: customerDoc.gstin,
      } : null,
    };

    await updateUserLastActivity();
    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error("GET /api/quotations/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch quotation", details: error.message },
      { status: 500 }
    );
  }
}

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

    // Convert ObjectId fields
    if (updateData.party_id) updateData.party_id = toObjectId(updateData.party_id);
    if (Array.isArray(updateData.items)) {
      updateData.items = updateData.items.map((item: any) => ({
        ...item,
        product_id: toObjectId(item.product_id),
      }));
    }

    const quotationsCollection = await getCollection<QuotationDoc>(COLLECTIONS.QUOTATIONS);

    // ✅ Check for unique quotation number if provided
    if (updateData.quotation_no) {
      const existing = await quotationsCollection.findOne({
        user_id: toObjectId(user.id),
        quotation_no: updateData.quotation_no,
      });
      if (existing && existing._id.toString() !== id) {
        return NextResponse.json({ 
          error: `Quotation number "${updateData.quotation_no}" already exists`,
          code: "DUPLICATE_QUOTATION_NO"
        }, { status: 400 });
      }
    }

    const filter = { _id: toObjectId(id), user_id: toObjectId(user.id) };

    // ✅ Use setLastUpdated instead of manual $set
    const updateResult = await setLastUpdated(quotationsCollection, filter, updateData);

    if (updateResult.matchedCount === 0) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    }

    // Fetch updated document
    const updated = await quotationsCollection.findOne(filter);
    if (!updated) {
      return NextResponse.json({ error: "Quotation not found after update" }, { status: 404 });
    }

    // ✅ Update user's last activity
    const usersCollection = await getCollection(COLLECTIONS.USERS);
    await setLastUpdated(usersCollection, { _id: toObjectId(user.id) });

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
      quotation_no: updated.quotation_no || "",
      status: updated.status || "open",
      created_at: updated.created_at,
      updated_at: updated.updated_at,
    };

    await updateUserLastActivity();
    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error("PUT /api/quotations/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update quotation", details: error.message },
      { status: 500 }
    );
  }
}

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

    const filter = { _id: toObjectId(id), user_id: toObjectId(user.id) };
    const deleteResult = await quotationsCollection.deleteOne(filter);

    if (deleteResult.deletedCount === 0) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    }

    // Fetch updated document to confirm status change (optional)
    const updated = await quotationsCollection.findOne(filter);

    // ✅ Update user's last activity
    const usersCollection = await getCollection(COLLECTIONS.USERS);
    await setLastUpdated(usersCollection, { _id: toObjectId(user.id) });

    await updateUserLastActivity();
    return NextResponse.json({
      success: true,
      message: "Quotation deleted successfully",
    });
  } catch (error: any) {
    console.error("DELETE /api/quotations/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete quotation", details: error.message },
      { status: 500 }
    );
  }
}