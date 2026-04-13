

import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS, toObjectId, isValidObjectId } from "@/lib/db/mongodb";
import { getCurrentUser } from "@/lib/auth/utils";

// Quotation status: open, converted, expired, cancelled
export type QuotationStatus = "open" | "converted" | "expired" | "cancelled";

export interface QuotationItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount?: number;
  tax?: number;
  amount: number;
}

export interface QuotationDoc {
  _id?: any;
  user_id: any;
  party_id: any;
  party_name: string;
  items: QuotationItem[];
  discount?: number;
  tax?: number;
  total_amount: number;
  validity_date: string;
  notes?: string;
  status: QuotationStatus;
  created_at: string;
  updated_at?: string;
}

// GET: List/search quotations
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    console.log("🔍 Current user:", user);
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const partyId = url.searchParams.get("partyId");
    const status = url.searchParams.get("status");

    // Get collection
    const quotationsCollection = await getCollection(COLLECTIONS.QUOTATIONS);
    
        // Build query - always use ObjectId for user_id and party_id
        const query: any = {};
        if (user.id) query.user_id = toObjectId(user.id);
        if (partyId && isValidObjectId(partyId)) query.party_id = toObjectId(partyId);
        if (status) query.status = status;

    console.log("📝 MongoDB Query:", JSON.stringify(query, null, 2));
    
    // Fetch quotations
    const quotations = await quotationsCollection
      .find(query)
      .sort({ created_at: -1 })
      .toArray();
    
    console.log(`✅ Found ${quotations.length} quotations`);

        // Format response - Convert all ObjectIds to strings
        const formatted = quotations.map((q) => ({
          _id: q._id?.toString(),
          user_id: q.user_id?.toString(),
          party_id: q.party_id?.toString(),
          party_name: q.party_name || "",
          items: Array.isArray(q.items) ? q.items.map((item: any) => ({
            ...item,
            product_id: item.product_id?.toString(),
          })) : [],
          discount: q.discount || 0,
          tax: q.tax || 0,
          total_amount: q.total_amount || 0,
          validity_date: q.validity_date || "",
          notes: q.notes || "",
          status: q.status || "open",
          created_at: q.created_at,
          updated_at: q.updated_at,
        }));
    
    console.log("📤 Sending response with", formatted.length, "quotations");
    return NextResponse.json(formatted);
    
  } catch (error) {
    console.error("❌ Error in GET quotations:", error);
    return NextResponse.json(
      { error: "Failed to fetch quotations", details: error.message },
      { status: 500 }
    );
  }
}

// POST: Create new quotation
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const data = await request.json();
    console.log("📦 Received quotation data:", data);

    // Validation
    if (!data.party_id) {
      return NextResponse.json({ error: "Party is required" }, { status: 400 });
    }
    
    if (!Array.isArray(data.items) || data.items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
    }

        // Prepare quotation document
        const quotation: any = {
          user_id: toObjectId(user.id),
          party_id: toObjectId(data.party_id),
          party_name: data.party_name || "",
          items: data.items.map((item: any) => ({
            product_id: toObjectId(item.product_id),
            product_name: item.product_name,
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price || item.sell_price),
            discount: Number(item.discount || 0),
            tax: Number(item.tax || 0),
            amount: Number(item.amount),
          })),
          discount: Number(data.discount || 0),
          discount_type: data.discount_type || "fixed",
          tax: Number(data.tax || 0),
          tax_type: data.tax_type || "fixed",
          total_amount: Number(data.total_amount),
          validity_date: data.validity_date,
          notes: data.notes || "",
          status: data.status || "open",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

    console.log("💾 Saving quotation:", JSON.stringify(quotation, null, 2));

    const quotationsCollection = await getCollection(COLLECTIONS.QUOTATIONS);
    const result = await quotationsCollection.insertOne(quotation);
    
    console.log("✅ Quotation saved with ID:", result.insertedId);
    
    // Return the created quotation with string ID
    return NextResponse.json({
      ...quotation,
      _id: result.insertedId.toString(),
      user_id: quotation.user_id.toString(),
      party_id: quotation.party_id.toString(),
    }, { status: 201 });
    
  } catch (error) {
    console.error("❌ Error in POST quotation:", error);
    return NextResponse.json(
      { error: "Failed to create quotation", details: error.message },
      { status: 500 }
    );
  }
}