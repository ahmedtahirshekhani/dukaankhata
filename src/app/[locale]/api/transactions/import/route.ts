// // src/app/[locale]/api/transactions/import/route.ts
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

//     // Convert to JSON with proper date handling
//     const data = XLSX.utils.sheet_to_json(worksheet, {
//       header: 1,
//       defval: "",
//       raw: false, // Convert dates to strings
//       dateNF: "yyyy-mm-dd", // Date format
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
//       "Item Name",
//       "Description",
//       "Type",
//       "Date",
//       "Amount (Rs.)",
//       "Customer Name",
//       "Customer Number",
//     ];

//     // Validate headers
//     const headerMap: Record<string, number> = {};
//     expectedHeaders.forEach((expectedHeader, index) => {
//       const foundIndex = headers.findIndex(
//         (h) => h.toString().trim() === expectedHeader
//       );
//       if (foundIndex === -1) {
//         throw new Error(`Missing required column: ${expectedHeader}`);
//       }
//       headerMap[expectedHeader] = foundIndex;
//     });

//     // Get products collection to match product names
//     const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
//     const userProducts = await productsCollection
//       .find({ user_id: toObjectId(user.id) })
//       .toArray();

//     // Create a map of product names to IDs
//     const productNameMap = new Map<
//       string,
//       { id: string; description?: string }
//     >();
//     userProducts.forEach((product) => {
//       const name = product.name?.toString().toLowerCase().trim();
//       if (name) {
//         productNameMap.set(name, {
//           id: product._id.toString(),
//           description: product.description?.toString(),
//         });
//       }
//     });

//     // Process data rows
//     const transactionsCollection = await getCollection(
//       COLLECTIONS.TRANSACTIONS
//     );
//     const transactionsToInsert: any[] = [];
//     const errors: string[] = [];
//     let successCount = 0;
//     let errorCount = 0;

//     for (let i = 1; i < data.length; i++) {
//       const row = data[i] as any[];
//       if (!row || row.length === 0) continue;

//       try {
//         // Extract values
//         const itemName = String(row[headerMap["Item Name"]] || "").trim();
//         const description = String(row[headerMap["Description"]] || "").trim();
//         const typeStr = String(row[headerMap["Type"]] || "")
//           .trim()
//           .toLowerCase();
//         const dateStr = String(row[headerMap["Date"]] || "").trim();
//         const amountStr = String(row[headerMap["Amount (Rs.)"]] || "").trim();
//         const customerName = String(
//           row[headerMap["Customer Name"]] || ""
//         ).trim();
//         const customerNumber = String(
//           row[headerMap["Customer Number"]] || ""
//         ).trim();

//         // Validate required fields
//         if (!itemName) {
//           errors.push(`Row ${i + 1}: Item Name is required`);
//           errorCount++;
//           continue;
//         }

//         if (!typeStr || (typeStr !== "income" && typeStr !== "expense")) {
//           errors.push(
//             `Row ${
//               i + 1
//             }: Type must be "Income" or "Expense" (found: ${typeStr})`
//           );
//           errorCount++;
//           continue;
//         }

//         const amount = parseFloat(amountStr);
//         if (isNaN(amount) || amount <= 0) {
//           errors.push(`Row ${i + 1}: Amount must be a positive number`);
//           errorCount++;
//           continue;
//         }

//         // Parse date - handle multiple formats
//         let created_at: Date;
//         if (dateStr) {
//           // Try parsing as date string (XLSX should have converted Excel dates)
//           // Handle common date formats: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY
//           const dateStrClean = dateStr.trim();

//           // Try parsing directly
//           created_at = new Date(dateStrClean);

//           // If that fails, try common formats
//           if (isNaN(created_at.getTime())) {
//             // Try YYYY-MM-DD format
//             if (/^\d{4}-\d{2}-\d{2}$/.test(dateStrClean)) {
//               created_at = new Date(dateStrClean + "T00:00:00");
//             }
//             // Try MM/DD/YYYY or DD/MM/YYYY
//             else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStrClean)) {
//               const parts = dateStrClean.split("/");
//               // Assume MM/DD/YYYY format
//               created_at = new Date(
//                 parseInt(parts[2]),
//                 parseInt(parts[0]) - 1,
//                 parseInt(parts[1])
//               );
//             }
//           }

//           if (isNaN(created_at.getTime())) {
//             errors.push(`Row ${i + 1}: Invalid date format: ${dateStr}`);
//             errorCount++;
//             continue;
//           }
//         } else {
//           created_at = new Date();
//         }

//         // Match product by name
//         const productNameLower = itemName.toLowerCase();
//         let productId: number | undefined;
//         let finalProductName = itemName;
//         let finalDescription = description || "";

//         if (productNameMap.has(productNameLower)) {
//           const product = productNameMap.get(productNameLower)!;
//           productId = parseInt(product.id);
//           finalProductName = itemName;
//           if (!finalDescription && product.description) {
//             finalDescription = product.description;
//           }
//         } else {
//           // Custom item - use negative ID
//           productId = -Date.now() - i; // Unique negative ID
//         }

//         // Prepare transaction
//         const transaction = {
//           productId: productId,
//           productName: finalProductName,
//           productDescription: finalDescription || undefined,
//           type: typeStr as "income" | "expense",
//           created_at: created_at.toISOString(),
//           amount: amount,
//           customerName: customerName || undefined,
//           customerNumber: customerNumber || undefined,
//           user_id: toObjectId(user.id),
//         };

//         transactionsToInsert.push(transaction);
//       } catch (error) {
//         errors.push(
//           `Row ${i + 1}: ${
//             error instanceof Error ? error.message : "Unknown error"
//           }`
//         );
//         errorCount++;
//       }
//     }

//     // Insert transactions in bulk
//     if (transactionsToInsert.length > 0) {
//       const result = await transactionsCollection.insertMany(
//         transactionsToInsert
//       );
//       successCount = result.insertedCount;
//     }

//     return NextResponse.json({
//       successCount,
//       errorCount,
//       errors: errors.slice(0, 10), // Return first 10 errors
//       totalRows: data.length - 1,
//     });
//   } catch (error) {
//     console.error("Error importing transactions:", error);
//     return NextResponse.json(
//       {
//         error:
//           error instanceof Error
//             ? error.message
//             : "Failed to import transactions",
//       },
//       { status: 500 }
//     );
//   }
// }







// src/app/[locale]/api/transactions/import/route.ts
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
      dateNF: "yyyy-mm-dd",
    });

    if (data.length < 2) {
      return NextResponse.json(
        { error: "Excel file must contain at least a header row and one data row" },
        { status: 400 }
      );
    }

    const headers = data[0] as string[];
    const expectedHeaders = [
      "Item Name",
      "Description",
      "Type",
      "Date",
      "Amount (Rs.)",
      "Customer Name",
      "Customer Number",
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
    const userProducts = await productsCollection
      .find({ user_id: toObjectId(user.id) })
      .toArray();

    const productNameMap = new Map<
      string,
      { id: string; description?: string }
    >();
    userProducts.forEach((product) => {
      const name = product.name?.toString().toLowerCase().trim();
      if (name) {
        productNameMap.set(name, {
          id: product._id.toString(),
          description: product.description?.toString(),
        });
      }
    });

    const transactionsCollection = await getCollection(COLLECTIONS.TRANSACTIONS);
    const transactionsToInsert: any[] = [];
    const errors: string[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 1; i < data.length; i++) {
      const row = data[i] as any[];
      if (!row || row.length === 0) continue;

      try {
        const itemName = String(row[headerMap["Item Name"]] || "").trim();
        const description = String(row[headerMap["Description"]] || "").trim();
        const typeStr = String(row[headerMap["Type"]] || "").trim().toLowerCase();
        const dateStr = String(row[headerMap["Date"]] || "").trim();
        const amountStr = String(row[headerMap["Amount (Rs.)"]] || "").trim();
        const customerName = String(row[headerMap["Customer Name"]] || "").trim();
        const customerNumber = String(row[headerMap["Customer Number"]] || "").trim();

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
          errors.push(`Row ${i + 1}: Amount must be a positive number`);
          errorCount++;
          continue;
        }

        let created_at: Date;
        if (dateStr) {
          const dateStrClean = dateStr.trim();
          created_at = new Date(dateStrClean);
          if (isNaN(created_at.getTime())) {
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStrClean)) {
              created_at = new Date(dateStrClean + "T00:00:00");
            } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStrClean)) {
              const parts = dateStrClean.split("/");
              created_at = new Date(
                parseInt(parts[2]),
                parseInt(parts[0]) - 1,
                parseInt(parts[1])
              );
            }
          }
          if (isNaN(created_at.getTime())) {
            errors.push(`Row ${i + 1}: Invalid date format: ${dateStr}`);
            errorCount++;
            continue;
          }
        } else {
          created_at = new Date();
        }

        const productNameLower = itemName.toLowerCase();
        let productId: number | undefined;
        let finalProductName = itemName;
        let finalDescription = description || "";

        if (productNameMap.has(productNameLower)) {
          const product = productNameMap.get(productNameLower)!;
          productId = parseInt(product.id);
          finalProductName = itemName;
          if (!finalDescription && product.description) {
            finalDescription = product.description;
          }
        } else {
          productId = -Date.now() - i;
        }

        const now = new Date();
        const transaction = {
          productId: productId,
          productName: finalProductName,
          productDescription: finalDescription || undefined,
          type: typeStr as "income" | "expense",
          created_at: created_at.toISOString(),
          amount: amount,
          customerName: customerName || undefined,
          customerNumber: customerNumber || undefined,
          user_id: toObjectId(user.id),
          created_at_db: now,
          updated_at: now, // ✅ added updated_at
        };

        transactionsToInsert.push(transaction);
      } catch (error) {
        errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : "Unknown error"}`);
        errorCount++;
      }
    }

    if (transactionsToInsert.length > 0) {
      const result = await transactionsCollection.insertMany(transactionsToInsert);
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
    console.error("Error importing transactions:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import transactions" },
      { status: 500 }
    );
  }
}