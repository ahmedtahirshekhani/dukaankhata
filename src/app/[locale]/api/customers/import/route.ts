import { getCollection, COLLECTIONS, toObjectId } from "@/lib/db/mongodb";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/utils";
import * as XLSX from "xlsx";

export async function POST(request: Request) {
  const user = (await getCurrentUser()) as { id: string } | null;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Parse FormData
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Read file as buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse Excel file
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
      raw: false,
    });

    if (data.length < 2) {
      return NextResponse.json(
        {
          error:
            "Excel file must contain at least a header row and one data row",
        },
        { status: 400 }
      );
    }

    // Extract headers (first row)
    const headers = data[0] as string[];
    const expectedHeaders = [
      "Name",
      "Email",
      "Phone",
      "Status",
    ];

    // Validate headers
    const headerMap: Record<string, number> = {};
    expectedHeaders.forEach((expectedHeader) => {
      const foundIndex = headers.findIndex(
        (h) => h.toString().trim() === expectedHeader
      );
      if (foundIndex === -1) {
        throw new Error(`Missing required column: ${expectedHeader}`);
      }
      headerMap[expectedHeader] = foundIndex;
    });

    // Process data rows
    const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);
    const customersToInsert: any[] = [];
    const errors: string[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 1; i < data.length; i++) {
      const row = data[i] as any[];
      if (!row || row.length === 0) continue;

      try {
        // Extract values
        const name = String(row[headerMap["Name"]] || "").trim();
        const email = String(row[headerMap["Email"]] || "").trim();
        const phone = String(row[headerMap["Phone"]] || "").trim();
        const statusStr = String(row[headerMap["Status"]] || "")
          .trim()
          .toLowerCase();

        // Validate required fields
        if (!name) {
          errors.push(`Row ${i + 1}: Name is required`);
          errorCount++;
          continue;
        }

        if (!email) {
          errors.push(`Row ${i + 1}: Email is required`);
          errorCount++;
          continue;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          errors.push(`Row ${i + 1}: Invalid email format: ${email}`);
          errorCount++;
          continue;
        }

        if (!phone) {
          errors.push(`Row ${i + 1}: Phone is required`);
          errorCount++;
          continue;
        }

        // Validate status (optional, defaults to active)
        let status: "active" | "inactive" = "active";
        if (statusStr) {
          if (statusStr === "active" || statusStr === "inactive") {
            status = statusStr;
          } else {
            errors.push(
              `Row ${i + 1}: Status must be "Active" or "Inactive" (found: ${statusStr}). Defaulting to Active.`
            );
            // Don't increment errorCount for this, just use default
          }
        }

        // Check for duplicate email (within the same user)
        const existingCustomer = await customersCollection.findOne({
          email: email,
          user_id: toObjectId(user.id),
        });

        if (existingCustomer) {
          errors.push(`Row ${i + 1}: Customer with email ${email} already exists`);
          errorCount++;
          continue;
        }

        // Prepare customer
        const customer = {
          name: name,
          email: email,
          phone: phone,
          status: status,
          user_id: toObjectId(user.id),
          created_at: new Date(),
          updated_at: new Date(),
        };

        customersToInsert.push(customer);
      } catch (error) {
        errors.push(
          `Row ${i + 1}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        errorCount++;
      }
    }

    // Insert customers in bulk
    if (customersToInsert.length > 0) {
      const result = await customersCollection.insertMany(customersToInsert);
      successCount = result.insertedCount;
    }

    return NextResponse.json({
      successCount,
      errorCount,
      errors: errors.slice(0, 10), // Return first 10 errors
      totalRows: data.length - 1,
    });
  } catch (error) {
    console.error("Error importing customers:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to import customers",
      },
      { status: 500 }
    );
  }
}
