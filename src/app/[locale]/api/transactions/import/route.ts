
// src/app/[locale]/api/transactions/import/route.ts
import { getCollection, COLLECTIONS, toObjectId, setLastUpdated } from "@/lib/db/mongodb";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/utils";
import * as XLSX from "xlsx";

// Helper: Parse date from various formats (Excel string, yyyy-mm-dd, mm/dd/yyyy, etc.)
function parseDateFromExcel(dateStr: string): Date | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  
  // Try ISO format (yyyy-mm-dd)
  let date = new Date(trimmed);
  if (!isNaN(date.getTime())) return date;
  
  // Try mm/dd/yyyy (common in Excel exports)
  const parts = trimmed.split('/');
  if (parts.length === 3 && parts[0].length <= 2 && parts[1].length <= 2 && parts[2].length === 4) {
    const month = parseInt(parts[0], 10) - 1;
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    date = new Date(year, month, day);
    if (!isNaN(date.getTime())) return date;
  }
  
  // Try dd/mm/yyyy
  const parts2 = trimmed.split('/');
  if (parts2.length === 3 && parts2[0].length <= 2 && parts2[1].length <= 2 && parts2[2].length === 4) {
    const day = parseInt(parts2[0], 10);
    const month = parseInt(parts2[1], 10) - 1;
    const year = parseInt(parts2[2], 10);
    date = new Date(year, month, day);
    if (!isNaN(date.getTime())) return date;
  }
  
  return null;
}

export async function POST(request: Request) {
  const user = (await getCurrentUser()) as { id: string } | null;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
      raw: false,
      dateNF: "yyyy-mm-dd",
    });

    if (data.length < 2) {
      return NextResponse.json(
        { error: "Excel file must contain at least a header row and one data row" },
        { status: 400 }
      );
    }

    const headers = data[0] as string[];
    // Updated expected headers to match manual POST structure
    const expectedHeaders = [
      "Item Name",
      "Description",
      "Type",
      "Date",
      "Amount (Rs.)",
      "Customer Name",
      "Customer Number",
      "UOM",
      "Quantity",
      "Unit Price"
    ];

    const headerMap: Record<string, number> = {};
    for (const expectedHeader of expectedHeaders) {
      const foundIndex = headers.findIndex(
        (h) => h.toString().trim() === expectedHeader
      );
      if (foundIndex === -1) {
        return NextResponse.json(
          { error: `Missing required column: ${expectedHeader}` },
          { status: 400 }
        );
      }
      headerMap[expectedHeader] = foundIndex;
    }

    // Get user's products for mapping
    const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
    const userProducts = await productsCollection
      .find({ user_id: toObjectId(user.id) })
      .toArray();

    const productNameMap = new Map<string, any>();
    userProducts.forEach((product) => {
      const name = product.name?.toString().toLowerCase().trim();
      if (name) {
        productNameMap.set(name, product);
      }
    });

    const transactionsCollection = await getCollection(COLLECTIONS.TRANSACTIONS);
    const transactionsToInsert: any[] = [];
    const errors: string[] = [];
    let successCount = 0;
    let errorCount = 0;

    // Process each row (skip header)
    for (let i = 1; i < data.length; i++) {
      const row = data[i] as any[];
      if (!row || row.length === 0) continue;

      try {
        const itemName = String(row[headerMap["Item Name"]] || "").trim();
        const description = String(row[headerMap["Description"]] || "").trim();
        const typeStr = String(row[headerMap["Type"]] || "").trim().toLowerCase();
        const dateStr = String(row[headerMap["Date"]] || "").trim();
        const amountStr = String(row[headerMap["Amount (Rs.)"]] || "").trim();
        const uomStr = String(row[headerMap["UOM"]] || "").trim();
        const quantityStr = String(row[headerMap["Quantity"]] || "").trim();
        const unitPriceStr = String(row[headerMap["Unit Price"]] || "").trim();
        const customerName = String(row[headerMap["Customer Name"]] || "").trim();
        const customerNumber = String(row[headerMap["Customer Number"]] || "").trim();

        // Validation
        if (!itemName) {
          errors.push(`Row ${i + 1}: Item Name is required`);
          errorCount++;
          continue;
        }

        if (!typeStr || (typeStr !== "income" && typeStr !== "expense")) {
          errors.push(
            `Row ${i + 1}: Type must be "Income" or "Expense" (found: ${typeStr})`
          );
          errorCount++;
          continue;
        }

        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) {
          errors.push(`Row ${i + 1}: Amount must be a positive number (found: ${amountStr})`);
          errorCount++;
          continue;
        }

        // Date parsing -> return Date object (same as manual POST)
        let created_at: Date = new Date(); // default today
        if (dateStr) {
          const parsedDate = parseDateFromExcel(dateStr);
          if (!parsedDate) {
            errors.push(`Row ${i + 1}: Invalid date format (use YYYY-MM-DD or MM/DD/YYYY): ${dateStr}`);
            errorCount++;
            continue;
          }
          created_at = parsedDate;
        }

        // Product mapping logic
        const productNameLower = itemName.toLowerCase();
        let productId: string | undefined;
        let finalProductName = itemName;
        let finalDescription = description || "";
        let uom = uomStr || "piece";
        let quantity = quantityStr ? parseFloat(quantityStr) : 1;
        let unitPrice = unitPriceStr ? parseFloat(unitPriceStr) : amount;

        if (productNameMap.has(productNameLower)) {
          const product = productNameMap.get(productNameLower)!;
          productId = product._id.toString();
          finalProductName = product.name || itemName;
          if (!finalDescription && product.description) {
            finalDescription = product.description;
          }
          if (!uomStr && product.uom) {
            uom = product.uom;
          }
          // If unit price not provided, use product's price based on type
          if (!unitPriceStr) {
            const price = typeStr === "expense" ? product.costPrice : product.sellPrice;
            if (price && !isNaN(price)) unitPrice = price;
          }
          // Auto-calculate quantity if not provided but amount and unit price are valid
          if (!quantityStr && unitPrice > 0) {
            quantity = Math.max(1, Math.round(amount / unitPrice));
          }
        }

        // Validate quantity and unitPrice
        if (isNaN(quantity) || quantity <= 0) quantity = 1;
        if (isNaN(unitPrice) || unitPrice <= 0) unitPrice = amount;

        const now = new Date();
        // Create transaction object EXACTLY matching manual POST structure
        const transaction = {
          productId: (productId && productId.match(/^[0-9a-fA-F]{24}$/)) ? toObjectId(productId) : productId,
          productName: finalProductName,
          productDescription: finalDescription || undefined,
          type: typeStr as "income" | "expense",
          created_at: created_at,        // Date object, not string
          amount: amount,
          customerName: customerName || undefined,
          customerNumber: customerNumber || undefined,
          uom: uom,
          quantity: quantity,
          unitPrice: unitPrice,
          user_id: toObjectId(user.id),
          updated_at: now,               // same as manual POST
          // ❌ No created_at_db field
        };

        transactionsToInsert.push(transaction);
      } catch (error) {
        errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : "Unknown error"}`);
        errorCount++;
      }
    }

    // Bulk insert
    if (transactionsToInsert.length > 0) {
      const result = await transactionsCollection.insertMany(transactionsToInsert);
      successCount = result.insertedCount;
    }

    // Update user's last activity (same as manual POST)
    const usersCollection = await getCollection(COLLECTIONS.USERS);
    await setLastUpdated(usersCollection, { _id: toObjectId(user.id) });

    return NextResponse.json({
      successCount,
      errorCount,
      errors: errors.slice(0, 10), // limit errors to 10 in response
      totalRows: data.length - 1,
    });
  } catch (error) {
    console.error("Error importing transactions:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import transactions" },
      { status: 500 }
    );
  }
}