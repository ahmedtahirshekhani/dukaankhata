// // src/app/[locale]/api/products/import/route.ts
// import { getCollection, COLLECTIONS, toObjectId } from "@/lib/db/mongodb";
// import { NextResponse } from "next/server";
// import { getCurrentUser } from "@/lib/auth/utils";
// import * as XLSX from "xlsx";

// export async function POST(request: Request) {
//   const user = (await getCurrentUser()) as { id: string } | null;

//   if (!user) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }

//   try {
//     // Parse FormData
//     const formData = await request.formData();
//     const file = formData.get("file") as File;

//     if (!file) {
//       return NextResponse.json({ error: "No file provided" }, { status: 400 });
//     }

//     // Read file as buffer
//     const arrayBuffer = await file.arrayBuffer();
//     const buffer = Buffer.from(arrayBuffer);

//     // Parse Excel file
//     const workbook = XLSX.read(buffer, { type: "buffer" });
//     const sheetName = workbook.SheetNames[0];
//     const worksheet = workbook.Sheets[sheetName];

//     // Convert to JSON
//     const data = XLSX.utils.sheet_to_json(worksheet, {
//       header: 1,
//       defval: "",
//       raw: false,
//     });

//     if (data.length < 2) {
//       return NextResponse.json(
//         {
//           error:
//             "Excel file must contain at least a header row and one data row",
//         },
//         { status: 400 }
//       );
//     }

//     // Extract headers (first row)
//     const headers = data[0] as string[];
//     const expectedHeaders = [
//       "Name",
//       "Description",
//       "Type",
//       "Sell Price (Rs.)",
//       "Cost Price (Rs.)",
//       "Quantity",
//       "Unit of Measurement",
//       "Category",
//       "Branch",
//     ];

//     // Validate headers
//     const headerMap: Record<string, number> = {};
//     expectedHeaders.forEach((expectedHeader) => {
//       const foundIndex = headers.findIndex(
//         (h) => h.toString().trim() === expectedHeader
//       );
//       if (foundIndex === -1) {
//         throw new Error(`Missing required column: ${expectedHeader}`);
//       }
//       headerMap[expectedHeader] = foundIndex;
//     });

//     // Process data rows
//     const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
//     const productsToInsert: any[] = [];
//     const errors: string[] = [];
//     let successCount = 0;
//     let errorCount = 0;

//     for (let i = 1; i < data.length; i++) {
//       const row = data[i] as any[];
//       if (!row || row.length === 0) continue;

//       try {
//         // Extract values
//         const name = String(row[headerMap["Name"]] || "").trim();
//         const description = String(row[headerMap["Description"]] || "").trim();
//         const typeStr = String(row[headerMap["Type"]] || "")
//           .trim()
//           .toLowerCase();
//         const sellPriceStr = String(
//           row[headerMap["Sell Price (Rs.)"]] || ""
//         ).trim();
//         const costPriceStr = String(
//           row[headerMap["Cost Price (Rs.)"]] || ""
//         ).trim();
//         const quantityStr = String(row[headerMap["Quantity"]] || "").trim();
//         const unitOfMeasurement = String(
//           row[headerMap["Unit of Measurement"]] || ""
//         ).trim();
//         const category = String(row[headerMap["Category"]] || "").trim();
//         const branch = String(row[headerMap["Branch"]] || "").trim();

//         // Validate required fields
//         if (!name) {
//           errors.push(`Row ${i + 1}: Name is required`);
//           errorCount++;
//           continue;
//         }

//         // Validate type
//         let type: string = "goods";
//         if (typeStr) {
//           if (typeStr === "goods" || typeStr === "services") {
//             type = typeStr;
//           } else if (
//             typeStr === "good" ||
//             typeStr === "service" ||
//             typeStr === "product"
//           ) {
//             type =
//               typeStr === "good" || typeStr === "product"
//                 ? "goods"
//                 : "services";
//           } else {
//             errors.push(
//               `Row ${
//                 i + 1
//               }: Type must be "Goods" or "Services" (found: ${typeStr})`
//             );
//             errorCount++;
//             continue;
//           }
//         }

//         // Parse prices (optional)
//         let sellPrice: number | undefined;
//         if (sellPriceStr && sellPriceStr !== "-") {
//           const parsed = parseFloat(sellPriceStr);
//           if (!isNaN(parsed) && parsed >= 0) {
//             sellPrice = parsed;
//           } else if (sellPriceStr !== "") {
//             errors.push(`Row ${i + 1}: Invalid sell price: ${sellPriceStr}`);
//             errorCount++;
//             continue;
//           }
//         }

//         let costPrice: number | undefined;
//         if (costPriceStr && costPriceStr !== "-") {
//           const parsed = parseFloat(costPriceStr);
//           if (!isNaN(parsed) && parsed >= 0) {
//             costPrice = parsed;
//           } else if (costPriceStr !== "") {
//             errors.push(`Row ${i + 1}: Invalid cost price: ${costPriceStr}`);
//             errorCount++;
//             continue;
//           }
//         }

//         // Parse quantity (optional)
//         let quantity: number | undefined;
//         if (quantityStr && quantityStr !== "-") {
//           const parsed = parseFloat(quantityStr);
//           if (!isNaN(parsed) && parsed >= 0) {
//             quantity = Math.floor(parsed);
//           } else if (quantityStr !== "") {
//             errors.push(`Row ${i + 1}: Invalid quantity: ${quantityStr}`);
//             errorCount++;
//             continue;
//           }
//         }

//         // Prepare product
//         const product: any = {
//           name: name,
//           type: type,
//           user_id: toObjectId(user.id),
//         };

//         // Add optional fields
//         if (description) {
//           product.description = description;
//         }
//         if (sellPrice !== undefined) {
//           product.sell_price = sellPrice;
//         }
//         if (costPrice !== undefined) {
//           product.cost_price = costPrice;
//         }
//         if (quantity !== undefined) {
//           product.quantity = quantity;
//           product.in_stock = quantity; // Also set in_stock for compatibility
//         }
//         if (unitOfMeasurement) {
//           product.unit_of_measurement = unitOfMeasurement;
//         }
//         if (category) {
//           product.category = category;
//         }
//         if (branch) {
//           product.branch = branch;
//         }

//         productsToInsert.push(product);
//       } catch (error) {
//         errors.push(
//           `Row ${i + 1}: ${
//             error instanceof Error ? error.message : "Unknown error"
//           }`
//         );
//         errorCount++;
//       }
//     }

//     // Insert products in bulk
//     if (productsToInsert.length > 0) {
//       const result = await productsCollection.insertMany(productsToInsert);
//       successCount = result.insertedCount;
//     }

//     return NextResponse.json({
//       successCount,
//       errorCount,
//       errors: errors.slice(0, 10), // Return first 10 errors
//       totalRows: data.length - 1,
//     });
//   } catch (error) {
//     console.error("Error importing products:", error);
//     return NextResponse.json(
//       {
//         error:
//           error instanceof Error ? error.message : "Failed to import products",
//       },
//       { status: 500 }
//     );
//   }
// }
// src/app/[locale]/api/products/import/route.ts
import { getCollection, COLLECTIONS, toObjectId, setLastUpdated } from "@/lib/db/mongodb";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/utils";
import * as XLSX from "xlsx";

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
    });

    if (data.length < 2) {
      return NextResponse.json(
        { error: "Excel file must contain at least a header row and one data row" },
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