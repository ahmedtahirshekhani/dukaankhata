
import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS, toObjectId, isValidObjectId, setLastUpdated, updateUserLastActivity } from "@/lib/db/mongodb";
import { getCurrentUser } from "@/lib/auth/utils";

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
  discount_type?: string;
  tax?: number;
  tax_type?: string;
  total_amount: number;
  validity_date: string;
  notes?: string;
  quotation_no?: string;
  status: QuotationStatus;
  converted_to_invoice_id?: string;
  created_at: string;
  updated_at?: string;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;
    const search = url.searchParams.get("search") || "";
    const partyId = url.searchParams.get("partyId");
    const status = url.searchParams.get("status");

    const quotationsCollection = await getCollection(COLLECTIONS.QUOTATIONS);
    
    const query: any = {};
    if (user.id) query.user_id = toObjectId(user.id);
    if (partyId && isValidObjectId(partyId)) query.party_id = toObjectId(partyId);
    if (status) query.status = status;
    
    if (search) {
      query.$or = [
        { party_name: { $regex: search, $options: "i" } },
        { quotation_no: { $regex: search, $options: "i" } },
        { notes: { $regex: search, $options: "i" } }
      ];
    }

    const totalItems = await quotationsCollection.countDocuments(query);
    const totalPages = limit === 0 ? 1 : Math.ceil(totalItems / limit);
    
    const cursor = quotationsCollection
      .find(query)
      .sort({ created_at: -1 });

    if (limit > 0) {
      cursor.skip(skip).limit(limit);
    }

    const quotations = await cursor.toArray();
    
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
      quotation_no: q.quotation_no || "",
      status: q.status || "open",
      created_at: q.created_at,
      updated_at: q.updated_at,
    }));
    
    await updateUserLastActivity();
    return NextResponse.json({
      quotations: formatted,
      pagination: {
        totalItems,
        totalPages,
        currentPage: page,
        pageSize: limit
      }
    });
    
  } catch (error) {
    console.error("❌ Error in GET quotations:", error);
    let errorMessage = "Failed to fetch quotations";
    if (error && typeof error === "object" && "message" in error && typeof (error as any).message === "string") {
      errorMessage = (error as any).message;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const data = await request.json();

    if (!data.party_id) {
      return NextResponse.json({ error: "Party is required" }, { status: 400 });
    }
    
    if (!Array.isArray(data.items) || data.items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
    }

    const now = new Date().toISOString();
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
      quotation_no: data.quotation_no || "",
      status: data.status || "open",
      created_at: now,
      updated_at: now,
    };

    const quotationsCollection = await getCollection(COLLECTIONS.QUOTATIONS);

    // ✅ Check for unique quotation number if provided
    if (data.quotation_no) {
      const existing = await quotationsCollection.findOne({
        user_id: toObjectId(user.id),
        quotation_no: data.quotation_no,
      });
      if (existing) {
        return NextResponse.json({ 
          error: `Quotation number "${data.quotation_no}" already exists`,
          code: "DUPLICATE_QUOTATION_NO" 
        }, { status: 400 });
      }
    }

    const result = await quotationsCollection.insertOne(quotation);
    
    // ✅ Update user's last activity
    const usersCollection = await getCollection(COLLECTIONS.USERS);
    await setLastUpdated(usersCollection, { _id: toObjectId(user.id) });
    
    await updateUserLastActivity();
    return NextResponse.json({
      ...quotation,
      _id: result.insertedId.toString(),
      user_id: quotation.user_id.toString(),
      party_id: quotation.party_id.toString(),
    }, { status: 201 });
    
  } catch (error) {
    console.error("❌ Error in POST quotation:", error);
    let errorMessage = "Failed to create quotation";
    if (error && typeof error === "object" && "message" in error && typeof (error as any).message === "string") {
      errorMessage = (error as any).message;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}