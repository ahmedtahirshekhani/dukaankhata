// src/app/[locale]/api/products/import/route.ts
import { getCollection, COLLECTIONS, toObjectId, setLastUpdated, updateUserLastActivity } from "@/lib/db/mongodb";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/utils";
import * as XLSX from "xlsx";

export async function POST(request: Request) {
  const user = (await getCurrentUser()) as { id: string } | null;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let data: any[] = [];
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      // Handle JSON data from preview
      const body = await request.json();
      if (!body.data || !Array.isArray(body.data)) {
        return NextResponse.json({ error: "Invalid data format" }, { status: 400 });
      }
      // Convert JSON objects to array format expected by the rest of the code
      const jsonData = body.data as Record<string, any>[];
      if (jsonData.length === 0) {
        return NextResponse.json({ error: "No data provided" }, { status: 400 });
      }
      // Get headers from first object
      const headers = Object.keys(jsonData[0]);
      data = [headers, ...jsonData.map((item) => headers.map((h) => item[h]))];
    } else {
      // Handle file upload
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
      data = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: "",
        raw: false,
      });
    }

    if (data.length < 2) {
      return NextResponse.json(
        { error: "No data rows found. Please ensure your file has at least one data row." },
        { status: 400 }
      );
    }

    const headers = data[0] as string[];
    const expectedHeaders = [
      "Name",
      "Description",
      "Type",
      "Sell Price (Rs.)",
      "Cost Price (Rs.)",
      "Quantity",
      "Unit of Measurement",
      "Category",
      "Branch",
    ];

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

    const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
    const productsToInsert: any[] = [];
    const errors: string[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 1; i < data.length; i++) {
      const row = data[i] as any[];
      if (!row || row.length === 0) continue;

      try {
        const name = String(row[headerMap["Name"]] || "").trim();
        const description = String(row[headerMap["Description"]] || "").trim();
        const typeStr = String(row[headerMap["Type"]] || "").trim().toLowerCase();
        const sellPriceStr = String(row[headerMap["Sell Price (Rs.)"]] || "").trim();
        const costPriceStr = String(row[headerMap["Cost Price (Rs.)"]] || "").trim();
        const quantityStr = String(row[headerMap["Quantity"]] || "").trim();
        const unitOfMeasurement = String(row[headerMap["Unit of Measurement"]] || "").trim();
        const category = String(row[headerMap["Category"]] || "").trim();
        const branch = String(row[headerMap["Branch"]] || "").trim();

        if (!name) {
          errors.push(`Row ${i + 1}: Name is required`);
          errorCount++;
          continue;
        }

        let type: string = "goods";
        if (typeStr) {
          if (typeStr === "goods" || typeStr === "services") {
            type = typeStr;
          } else if (typeStr === "good" || typeStr === "service" || typeStr === "product") {
            type = (typeStr === "good" || typeStr === "product") ? "goods" : "services";
          } else {
            errors.push(`Row ${i + 1}: Type must be "Goods" or "Services" (found: ${typeStr})`);
            errorCount++;
            continue;
          }
        }

        let sellPrice: number | undefined;
        if (sellPriceStr && sellPriceStr !== "-") {
          const parsed = parseFloat(sellPriceStr);
          if (!isNaN(parsed) && parsed >= 0) {
            sellPrice = parsed;
          } else if (sellPriceStr !== "") {
            errors.push(`Row ${i + 1}: Invalid sell price: ${sellPriceStr}`);
            errorCount++;
            continue;
          }
        }

        let costPrice: number | undefined;
        if (costPriceStr && costPriceStr !== "-") {
          const parsed = parseFloat(costPriceStr);
          if (!isNaN(parsed) && parsed >= 0) {
            costPrice = parsed;
          } else if (costPriceStr !== "") {
            errors.push(`Row ${i + 1}: Invalid cost price: ${costPriceStr}`);
            errorCount++;
            continue;
          }
        }

        let quantity: number | undefined;
        if (quantityStr && quantityStr !== "-") {
          const parsed = parseFloat(quantityStr);
          if (!isNaN(parsed) && parsed >= 0) {
            quantity = Math.floor(parsed);
          } else if (quantityStr !== "") {
            errors.push(`Row ${i + 1}: Invalid quantity: ${quantityStr}`);
            errorCount++;
            continue;
          }
        }

        const now = new Date();
        const product: any = {
          name,
          type,
          user_id: toObjectId(user.id),
          created_at: now,
          updated_at: now,
        };

        if (description) product.description = description;
        if (sellPrice !== undefined) product.sell_price = sellPrice;
        if (costPrice !== undefined) product.cost_price = costPrice;
        if (quantity !== undefined) {
          product.quantity = quantity;
          product.in_stock = quantity;
        }
        if (unitOfMeasurement) product.unit_of_measurement = unitOfMeasurement;
        if (category) product.category = category;
        if (branch) product.branch = branch;

        productsToInsert.push(product);
      } catch (error) {
        errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : "Unknown error"}`);
        errorCount++;
      }
    }

    if (productsToInsert.length > 0) {
      const result = await productsCollection.insertMany(productsToInsert);
      successCount = result.insertedCount;
    }

    // ✅ Update user's last activity after bulk import
    const usersCollection = await getCollection(COLLECTIONS.USERS);
    await setLastUpdated(usersCollection, { _id: toObjectId(user.id) });

    await updateUserLastActivity();
    return NextResponse.json({
      successCount,
      errorCount,
      errors: errors.slice(0, 10),
      totalRows: data.length - 1,
    });
  } catch (error) {
    console.error("Error importing products:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import products" },
      { status: 500 }
    );
  }
}