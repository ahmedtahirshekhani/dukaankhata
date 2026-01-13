import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS } from "@/lib/mongodb";

interface WaitlistFormData {
  name: string;
  whatsappNumber: string;
  companyName?: string;
  companyAddress?: string;
  category?: string;
  description?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: WaitlistFormData = await request.json();
    const {
      name,
      whatsappNumber,
      companyName,
      companyAddress,
      category,
      description,
    } = body;

    // Validation for required fields
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!whatsappNumber || !whatsappNumber.trim()) {
      return NextResponse.json(
        { error: "WhatsApp number is required" },
        { status: 400 }
      );
    }

    // Validate name length
    if (name.trim().length < 2) {
      return NextResponse.json(
        { error: "Name must be at least 2 characters long" },
        { status: 400 }
      );
    }

    // Basic phone number validation (should contain at least some digits)
    const phoneRegex = /\d+/;
    if (!phoneRegex.test(whatsappNumber)) {
      return NextResponse.json(
        { error: "Please enter a valid WhatsApp number" },
        { status: 400 }
      );
    }

    // If category is "Other", description is required
    if (category === "Other" && (!description || !description.trim())) {
      return NextResponse.json(
        { error: "Description is required when category is 'Other'" },
        { status: 400 }
      );
    }

    const waitlistCollection = await getCollection(COLLECTIONS.WAITLIST);

    // Check if WhatsApp number already exists
    const existingEntry = await waitlistCollection.findOne({
      whatsapp_number: whatsappNumber.trim(),
    });

    if (existingEntry) {
      return NextResponse.json(
        { error: "This WhatsApp number is already registered in our waitlist" },
        { status: 400 }
      );
    }

    // Prepare document for insertion
    const waitlistDocument = {
      name: name.trim(),
      whatsapp_number: whatsappNumber.trim(),
      company_name: companyName?.trim() || null,
      company_address: companyAddress?.trim() || null,
      category: category?.trim() || null,
      description: description?.trim() || null,
      status: "pending",
      created_at: new Date(),
      updated_at: new Date(),
    };

    // Insert the waitlist entry
    const result = await waitlistCollection.insertOne(waitlistDocument);

    if (!result.insertedId) {
      return NextResponse.json(
        { error: "Failed to join waitlist. Please try again." },
        { status: 500 }
      );
    }

    // Fetch the created document
    const newEntry = await waitlistCollection.findOne({
      _id: result.insertedId,
    });

    // Return success response
    return NextResponse.json(
      {
        success: true,
        message:
          "Successfully joined the waitlist! We'll contact you soon on WhatsApp.",
        data: {
          id: newEntry?._id.toString(),
          name: newEntry?.name,
          whatsappNumber: newEntry?.whatsapp_number,
          companyName: newEntry?.company_name,
          category: newEntry?.category,
          createdAt: newEntry?.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Waitlist submission error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}

// Optional: GET endpoint to retrieve waitlist entries (for admin)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const waitlistCollection = await getCollection(COLLECTIONS.WAITLIST);

    // Build query
    const query: any = {};
    if (status && status !== "all") {
      query.status = status;
    }

    // Fetch waitlist entries
    const entries = await waitlistCollection
      .find(query)
      .sort({ created_at: -1 })
      .toArray();

    // Transform data for response
    const formattedEntries = entries.map((entry) => ({
      id: entry._id.toString(),
      name: entry.name,
      whatsappNumber: entry.whatsapp_number,
      companyName: entry.company_name,
      companyAddress: entry.company_address,
      category: entry.category,
      description: entry.description,
      status: entry.status,
      createdAt: entry.created_at,
      updatedAt: entry.updated_at,
    }));

    return NextResponse.json({
      success: true,
      count: formattedEntries.length,
      data: formattedEntries,
    });
  } catch (error) {
    console.error("Error fetching waitlist entries:", error);
    return NextResponse.json(
      { error: "Failed to fetch waitlist entries" },
      { status: 500 }
    );
  }
}
