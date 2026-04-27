// import { NextRequest, NextResponse } from "next/server";
// import { getCollection, COLLECTIONS, toObjectId, isValidObjectId } from "@/lib/db/mongodb";
// import { getCurrentUser } from "@/lib/auth/utils";
// import type { QuotationDoc } from "../../route";

// interface InvoiceDoc {
//   user_id: any;
//   party_id: any;
//   party_name: string;
//   items: any[];
//   discount: number;
//   discount_type: string;
//   tax: number;
//   tax_type: string;
//   total_amount: number;
//   paid_amount: number;
//   balance_due: number;
//   is_paid: boolean;
//   notes?: string;
//   quotation_id: any;
//   status: string;
//   created_at: string;
// }

// // POST /api/quotations/:id/convert — Convert to invoice
// export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
//   const user = await getCurrentUser();
//   if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
//   const { id } = params;
//   if (!isValidObjectId(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  
//   const quotationsCollection = await getCollection<QuotationDoc>(COLLECTIONS.QUOTATIONS);
//   const quotation = await quotationsCollection.findOne({ 
//     _id: toObjectId(id), 
//     user_id: toObjectId(user.id) 
//   });
  
//   if (!quotation) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
//   if (quotation.converted_to_invoice_id) {
//     return NextResponse.json({ 
//       message: "Quotation already converted to invoice", 
//       invoice_id: quotation.converted_to_invoice_id 
//     });
//   }

//   try {
//     // Create invoice from quotation
//     const ordersCollection = await getCollection<InvoiceDoc>(COLLECTIONS.ORDERS);
    
//     const invoiceData: InvoiceDoc = {
//       user_id: quotation.user_id,
//       party_id: quotation.party_id,
//       party_name: quotation.party_name,
//       items: quotation.items || [],
//       discount: quotation.discount || 0,
//       discount_type: quotation.discount_type || "fixed",
//       tax: quotation.tax || 0,
//       tax_type: quotation.tax_type || "fixed",
//       total_amount: quotation.total_amount || 0,
//       paid_amount: 0,
//       balance_due: quotation.total_amount || 0,
//       is_paid: false,
//       notes: quotation.notes || "",
//       quotation_id: toObjectId(id),
//       status: "draft",
//       created_at: new Date().toISOString(),
//     };

//     const invoiceResult = await ordersCollection.insertOne(invoiceData);

//     // Update quotation to mark as converted
//     await quotationsCollection.updateOne(
//       { _id: toObjectId(id) },
//       {
//         $set: {
//           converted_to_invoice_id: invoiceResult.insertedId.toString(),
//           status: "converted",
//           updated_at: new Date().toISOString(),
//         },
//       }
//     );

//     return NextResponse.json({
//       success: true,
//       message: "Quotation converted to invoice successfully",
//       invoice_id: invoiceResult.insertedId.toString(),
//     });
//   } catch (error) {
//     console.error("Conversion error:", error);
//     return NextResponse.json(
//       { error: "Failed to convert quotation to invoice" },
//       { status: 500 }
//     );
//   }
// }




import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS, toObjectId, isValidObjectId, setLastUpdated } from "@/lib/db/mongodb";
import { getCurrentUser } from "@/lib/auth/utils";
import type { QuotationDoc } from "../../route";

interface InvoiceDoc {
  user_id: any;
  party_id: any;
  party_name: string;
  items: any[];
  discount: number;
  discount_type: string;
  tax: number;
  tax_type: string;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  is_paid: boolean;
  notes?: string;
  quotation_id: any;
  status: string;
  created_at: string;
  updated_at?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  
  const quotationsCollection = await getCollection<QuotationDoc>(COLLECTIONS.QUOTATIONS);
  const quotation = await quotationsCollection.findOne({ 
    _id: toObjectId(id), 
    user_id: toObjectId(user.id) 
  });
  
  if (!quotation) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
  if (quotation.converted_to_invoice_id) {
    return NextResponse.json({ 
      message: "Quotation already converted to invoice", 
      invoice_id: quotation.converted_to_invoice_id 
    });
  }

  try {
    const ordersCollection = await getCollection<InvoiceDoc>(COLLECTIONS.ORDERS);
    
    const now = new Date().toISOString();
    const invoiceData: InvoiceDoc = {
      user_id: quotation.user_id,
      party_id: quotation.party_id,
      party_name: quotation.party_name,
      items: quotation.items || [],
      discount: quotation.discount || 0,
      discount_type: quotation.discount_type || "fixed",
      tax: quotation.tax || 0,
      tax_type: quotation.tax_type || "fixed",
      total_amount: quotation.total_amount || 0,
      paid_amount: 0,
      balance_due: quotation.total_amount || 0,
      is_paid: false,
      notes: quotation.notes || "",
      quotation_id: toObjectId(id),
      status: "draft",
      created_at: now,
      updated_at: now,
    };

    const invoiceResult = await ordersCollection.insertOne(invoiceData);

    // ✅ Update quotation: mark converted, update timestamp, set invoice id
    const filter = { _id: toObjectId(id) };
    const updateResult = await setLastUpdated(quotationsCollection, filter, {
      converted_to_invoice_id: invoiceResult.insertedId.toString(),
      status: "converted",
    });

    if (updateResult.matchedCount === 0) {
      // If update fails, revert? For simplicity just log error
      console.error("Failed to update quotation after conversion");
    }

    // ✅ Update user's last activity
    const usersCollection = await getCollection(COLLECTIONS.USERS);
    await setLastUpdated(usersCollection, { _id: toObjectId(user.id) });

    return NextResponse.json({
      success: true,
      message: "Quotation converted to invoice successfully",
      invoice_id: invoiceResult.insertedId.toString(),
    });
  } catch (error) {
    console.error("Conversion error:", error);
    return NextResponse.json(
      { error: "Failed to convert quotation to invoice" },
      { status: 500 }
    );
  }
}