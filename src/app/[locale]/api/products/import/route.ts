// src/app/[locale]/api/products/import/route.ts
import {
  getCollection,
  COLLECTIONS,
  toObjectId,
  setLastUpdated,
  updateUserLastActivity,
} from "@/lib/db/mongodb";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/utils";
import { requirePermission } from "@/lib/auth/rbac";
import * as XLSX from "xlsx";

function findColIndex(headers: string[], patterns: RegExp[]): number {
  return headers.findIndex((h) => {
    const clean = String(h || "").trim().toLowerCase();
    return patterns.some((p) => p.test(clean));
  });
}

export async function POST(request: Request) {
  const user = (await getCurrentUser()) as { id: string } | null;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authCheck = await requirePermission("products.create");
  if (!authCheck.allowed) return authCheck.response!;

  try {
    let data: any[] = [];
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      // Handle JSON data from preview
      const body = await request.json();
      if (!body.data || !Array.isArray(body.data)) {
        return NextResponse.json({ error: "Invalid data format" }, { status: 400 });
      }
      const jsonData = body.data as Record<string, any>[];
      if (jsonData.length === 0) {
        return NextResponse.json({ error: "No data provided" }, { status: 400 });
      }

      // Extract all unique headers across all rows
      const headerSet = new Set<string>();
      jsonData.forEach((item) => {
        Object.keys(item).forEach((k) => headerSet.add(k));
      });
      const headers = Array.from(headerSet);
      data = [headers, ...jsonData.map((item) => headers.map((h) => item[h] ?? ""))];
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

    const headers = (data[0] as string[]).map((h) => String(h || "").trim());

    // Flexible column index mapping
    const nameIndex = findColIndex(headers, [
      /^(name|product\s*name|item\s*name|item|product|title)$/i,
    ]);
    const descIndex = findColIndex(headers, [
      /^(description|desc|details?|notes?)$/i,
    ]);
    const typeIndex = findColIndex(headers, [
      /^(type|item\s*type|product\s*type)$/i,
    ]);
    const sellPriceIndex = findColIndex(headers, [
      /^(sell\s*price.*|sale\s*price.*|selling\s*price.*|retail\s*price.*|price|rate|mrp)$/i,
    ]);
    const costPriceIndex = findColIndex(headers, [
      /^(cost\s*price.*|purchase\s*price.*|buy\s*price.*|cost|wholesale.*)$/i,
    ]);
    const quantityIndex = findColIndex(headers, [
      /^(quantity|qty|stock|in\s*stock|opening\s*stock|count)$/i,
    ]);
    const uomIndex = findColIndex(headers, [
      /^(unit\s*of\s*measurement|uom|unit|measurement)$/i,
    ]);
    const categoryIndex = findColIndex(headers, [
      /^(category|cat|category\s*name|group)$/i,
    ]);
    const branchIndex = findColIndex(headers, [
      /^(branch|branch\s*name|store|shop|location|warehouse)$/i,
    ]);

    if (nameIndex === -1) {
      return NextResponse.json(
        { error: "Missing required column: 'Name' (or 'Product Name' / 'Item Name')" },
        { status: 400 }
      );
    }

    const userObjectId = toObjectId(user.id);
    const now = new Date();

    // 1. Fetch existing categories and branches for this tenant
    const categoriesCollection = await getCollection(COLLECTIONS.CATEGORIES);
    const branchesCollection = await getCollection(COLLECTIONS.BRANCHES);

    const [existingCategories, existingBranches] = await Promise.all([
      categoriesCollection.find({ user_id: userObjectId }).toArray(),
      branchesCollection.find({ user_id: userObjectId }).toArray(),
    ]);

    const categoryMap = new Map<string, { id: string; name: string }>();
    existingCategories.forEach((cat: any) => {
      if (cat.name) {
        categoryMap.set(cat.name.trim().toLowerCase(), {
          id: cat._id.toString(),
          name: cat.name.trim(),
        });
      }
    });

    const branchMap = new Map<string, { id: string; name: string }>();
    existingBranches.forEach((br: any) => {
      if (br.name) {
        branchMap.set(br.name.trim().toLowerCase(), {
          id: br._id.toString(),
          name: br.name.trim(),
        });
      }
    });

    // 2. Scan rows for missing categories & branches
    const newCategoriesToCreate: string[] = [];
    const newBranchesToCreate: string[] = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i] as any[];
      if (!row || row.length === 0) continue;

      if (categoryIndex !== -1) {
        const rawCat = String(row[categoryIndex] || "").trim();
        if (rawCat && rawCat !== "-" && !categoryMap.has(rawCat.toLowerCase())) {
          categoryMap.set(rawCat.toLowerCase(), { id: "", name: rawCat });
          newCategoriesToCreate.push(rawCat);
        }
      }

      if (branchIndex !== -1) {
        const rawBranch = String(row[branchIndex] || "").trim();
        if (rawBranch && rawBranch !== "-" && !branchMap.has(rawBranch.toLowerCase())) {
          branchMap.set(rawBranch.toLowerCase(), { id: "", name: rawBranch });
          newBranchesToCreate.push(rawBranch);
        }
      }
    }

    // 3. Auto-create missing categories in DB
    const newlyCreatedCategories: { id: string; name: string }[] = [];
    if (newCategoriesToCreate.length > 0) {
      const catDocs = newCategoriesToCreate.map((name) => ({
        name,
        user_id: userObjectId,
        createdAt: now,
        created_at: now,
        updated_at: now,
      }));
      const insertResult = await categoriesCollection.insertMany(catDocs);
      catDocs.forEach((doc, idx) => {
        const item = {
          id: insertResult.insertedIds[idx].toString(),
          name: doc.name,
        };
        categoryMap.set(doc.name.toLowerCase(), item);
        newlyCreatedCategories.push(item);
      });
    }

    // 4. Auto-create missing branches in DB
    const newlyCreatedBranches: { id: string; name: string }[] = [];
    if (newBranchesToCreate.length > 0) {
      const branchDocs = newBranchesToCreate.map((name) => ({
        name,
        user_id: userObjectId,
        createdAt: now,
        created_at: now,
        updated_at: now,
      }));
      const insertResult = await branchesCollection.insertMany(branchDocs);
      branchDocs.forEach((doc, idx) => {
        const item = {
          id: insertResult.insertedIds[idx].toString(),
          name: doc.name,
        };
        branchMap.set(doc.name.toLowerCase(), item);
        newlyCreatedBranches.push(item);
      });
    }

    // 5. Parse & validate products
    const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
    const productsToInsert: any[] = [];
    const errors: string[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 1; i < data.length; i++) {
      const row = data[i] as any[];
      if (!row || row.length === 0) continue;

      try {
        const name = nameIndex !== -1 ? String(row[nameIndex] || "").trim() : "";
        if (!name) {
          const hasAnyValue = row.some(
            (c) => c !== undefined && c !== null && String(c).trim() !== ""
          );
          if (!hasAnyValue) continue; // skip blank rows
          errors.push(`Row ${i + 1}: Name is required`);
          errorCount++;
          continue;
        }

        const description = descIndex !== -1 ? String(row[descIndex] || "").trim() : "";
        const typeRaw = typeIndex !== -1 ? String(row[typeIndex] || "").trim().toLowerCase() : "";
        let type = "goods";
        if (typeRaw) {
          if (typeRaw === "services" || typeRaw === "service") {
            type = "services";
          } else if (typeRaw === "goods" || typeRaw === "good" || typeRaw === "product") {
            type = "goods";
          }
        }

        const sellPriceStr = sellPriceIndex !== -1 ? String(row[sellPriceIndex] || "").trim() : "";
        let sellPrice: number | undefined;
        if (sellPriceStr && sellPriceStr !== "-") {
          const parsed = parseFloat(sellPriceStr.replace(/[^0-9.-]/g, ""));
          if (!isNaN(parsed)) {
            sellPrice = parsed;
          }
        }

        const costPriceStr = costPriceIndex !== -1 ? String(row[costPriceIndex] || "").trim() : "";
        let costPrice: number | undefined;
        if (costPriceStr && costPriceStr !== "-") {
          const parsed = parseFloat(costPriceStr.replace(/[^0-9.-]/g, ""));
          if (!isNaN(parsed)) {
            costPrice = parsed;
          }
        }

        // Allow negative quantity!
        const qtyStr = quantityIndex !== -1 ? String(row[quantityIndex] || "").trim() : "";
        let quantity: number | undefined;
        if (qtyStr && qtyStr !== "-") {
          const parsed = parseFloat(qtyStr.replace(/[^0-9.-]/g, ""));
          if (!isNaN(parsed)) {
            quantity = Math.floor(parsed);
          } else if (qtyStr !== "") {
            errors.push(`Row ${i + 1}: Invalid quantity: ${qtyStr}`);
            errorCount++;
            continue;
          }
        }

        const unitOfMeasurement = uomIndex !== -1 ? String(row[uomIndex] || "").trim() : "";

        let category: string | undefined;
        if (categoryIndex !== -1) {
          const rawCat = String(row[categoryIndex] || "").trim();
          if (rawCat && rawCat !== "-") {
            category = categoryMap.get(rawCat.toLowerCase())?.name || rawCat;
          }
        }

        let branch: string | undefined;
        if (branchIndex !== -1) {
          const rawBranch = String(row[branchIndex] || "").trim();
          if (rawBranch && rawBranch !== "-") {
            branch = branchMap.get(rawBranch.toLowerCase())?.name || rawBranch;
          }
        }

        const product: any = {
          name,
          type,
          user_id: userObjectId,
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
        if (unitOfMeasurement && unitOfMeasurement !== "-") {
          product.unit_of_measurement = unitOfMeasurement;
        }
        if (category) product.category = category;
        if (branch) product.branch = branch;

        productsToInsert.push(product);
      } catch (error) {
        errors.push(
          `Row ${i + 1}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        errorCount++;
      }
    }

    // 6. Insert products into MongoDB
    if (productsToInsert.length > 0) {
      const result = await productsCollection.insertMany(productsToInsert);
      successCount = result.insertedCount;
    }

    // Map inserted products to frontend/Dexie format
    const mappedProducts = productsToInsert.map((p) => ({
      ...p,
      id: p._id.toString(),
      _id: p._id.toString(),
      user_id: p.user_id.toString(),
      sell_price_str: p.sell_price !== undefined ? String(p.sell_price) : "",
      cost_price_str: p.cost_price !== undefined ? String(p.cost_price) : "",
      quantity_str: p.quantity !== undefined ? String(p.quantity) : "",
      created_at: p.created_at instanceof Date ? p.created_at.toISOString() : p.created_at,
      updated_at: p.updated_at instanceof Date ? p.updated_at.toISOString() : p.updated_at,
    }));

    // Update user's last activity
    const usersCollection = await getCollection(COLLECTIONS.USERS);
    await setLastUpdated(usersCollection, { _id: userObjectId });
    await updateUserLastActivity();

    return NextResponse.json({
      success: true,
      successCount,
      errorCount,
      errors: errors.slice(0, 10),
      totalRows: data.length - 1,
      products: mappedProducts,
      newCategories: newlyCreatedCategories,
      newBranches: newlyCreatedBranches,
      allCategories: Array.from(categoryMap.values()).filter((c) => Boolean(c.id)),
      allBranches: Array.from(branchMap.values()).filter((b) => Boolean(b.id)),
    });
  } catch (error) {
    console.error("Error importing products:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import products" },
      { status: 500 }
    );
  }
}
