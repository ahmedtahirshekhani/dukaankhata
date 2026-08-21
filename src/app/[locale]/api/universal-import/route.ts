import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/utils";
import * as XLSX from "xlsx";
import AdmZip from "adm-zip";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject } from "ai";
import { z } from "zod";
import fs from "fs";
import path from "path";
import os from "os";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

import { getCollection, COLLECTIONS, toObjectId } from "@/lib/db/mongodb";

export const maxDuration = 60; // Increase Vercel function timeout if applicable

async function parseBuffer(buffer: Buffer, fileName: string): Promise<{ name: string; data: any[] }[]> {
  let datasets: { name: string; data: any[] }[] = [];
  console.log(`[API/UniversalImport/Parser] Analyzing buffer for file: ${fileName}`);

  // 1. Try SQLite Database
  const isSQLite = buffer.length > 16 && buffer.toString("utf8", 0, 16).includes("SQLite format 3");
  if (isSQLite || fileName.endsWith(".db") || fileName.endsWith(".sqlite") || fileName.endsWith(".vyb")) {
    console.log(`[API/UniversalImport/Parser] Detected potential SQLite DB: ${fileName}`);
    const tempPath = path.join(os.tmpdir(), `temp_${Date.now()}_${Math.random().toString(36).substring(7)}.db`);
    try {
      fs.writeFileSync(tempPath, buffer);
      const db = await open({ filename: tempPath, driver: sqlite3.Database });
      const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
      console.log(`[API/UniversalImport/Parser] Found ${tables.length} tables in SQLite DB.`);
      for (const table of tables) {
        const rows = await db.all(`SELECT * FROM "${table.name}"`); // Fetch all rows or limit if necessary
        if (rows.length > 0) {
          datasets.push({ name: table.name, data: rows });
        }
      }
      await db.close();
      try { fs.unlinkSync(tempPath); } catch (e) { console.warn("Could not delete temp file", e); }
      if (datasets.length > 0) return datasets;
    } catch (dbError) {
      console.warn(`[API/UniversalImport/Parser] SQLite parsing failed for ${fileName}:`, dbError);
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch (unlinkError) {
        console.warn(`[API/UniversalImport/Parser] Could not delete temp file ${tempPath}:`, unlinkError);
      }
    }
  }

  // 2. Try ZIP Archive
  const isZip = buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (isZip || fileName.endsWith(".zip")) {
    console.log(`[API/UniversalImport/Parser] Detected potential ZIP Archive: ${fileName}`);
    try {
      const archive = new AdmZip(buffer);
      const entries = archive.getEntries();
      console.log(`[API/UniversalImport/Parser] Found ${entries.length} files in ZIP.`);
      for (const entry of entries) {
        if (!entry.isDirectory) {
          console.log(`[API/UniversalImport/Parser] Extracting inner file: ${entry.name}`);
          const innerBuffer = entry.getData();
          // Recursively parse files inside the ZIP (skip nested ZIPs to avoid infinite loops)
          if (!entry.name.endsWith(".zip")) {
            const innerDatasets = await parseBuffer(innerBuffer, entry.name);
            datasets.push(...innerDatasets);
          }
        }
      }
      if (datasets.length > 0) return datasets;
    } catch (zipError) {
      console.warn(`[API/UniversalImport/Parser] ZIP parsing failed for ${fileName}:`, zipError);
    }
  }

  // 3. Try Excel / CSV
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      if (jsonData.length > 0) {
        datasets.push({ name: `${fileName}_${sheetName}`, data: jsonData });
      }
    });
    if (datasets.length > 0) return datasets;
  } catch (excelError) {
    // Ignore and fallback
  }

  // 4. Try JSON
  try {
    const text = buffer.toString("utf-8");
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      datasets.push({ name: fileName, data: parsed });
    } else if (typeof parsed === "object") {
      for (const [key, value] of Object.entries(parsed)) {
        if (Array.isArray(value) && value.length > 0) {
          datasets.push({ name: `${fileName}_${key}`, data: value });
        }
      }
    }
    if (datasets.length > 0) return datasets;
  } catch (jsonError) {
    // Ignore and fallback
  }

  // 5. Try SQL Dump (INSERT statements)
  try {
    const text = buffer.toString("utf-8");
    const insertRegex = /INSERT INTO `?(\w+)`? \((.*?)\) VALUES \((.*?)\);/gi;
    let match;
    const sqlTables: Record<string, any[]> = {};
    while ((match = insertRegex.exec(text)) !== null) {
      const tableName = match[1];
      const cols = match[2].split(",").map(c => c.trim().replace(/`/g, ''));
      const vals = match[3].split(",").map(v => v.trim().replace(/^'|'$/g, ''));
      if (!sqlTables[tableName]) sqlTables[tableName] = [];
      const rowObj: any = {};
      cols.forEach((col, i) => { rowObj[col] = vals[i] ?? ""; });
      sqlTables[tableName].push(rowObj);
    }
    for (const [tName, tData] of Object.entries(sqlTables)) {
      if (tData.length > 0) datasets.push({ name: `${fileName}_${tName}`, data: tData });
    }
  } catch (sqlError) {
    // End of parsing attempts
  }

  return datasets;
}

async function handleDirectImport(rows: any[], moduleType: string, userId: string) {
  const uId = toObjectId(userId);
  const now = new Date();

  switch (moduleType) {
    case "parties": {
      const partiesColl = await getCollection(COLLECTIONS.PARTIES);
      const docs = rows.map(r => ({
        user_id: uId,
        name: r.name || "Unknown Party",
        phone: r.phone || "",
        type: r.type || (Number(r.balance) < 0 ? "vendor" : "customer"),
        balance: Number(r.balance) || 0,
        company_name: r.company_name || "",
        company_address: r.company_address || "",
        created_at: now,
        updated_at: now
      }));
      if (docs.length > 0) await partiesColl.insertMany(docs);
      break;
    }
    case "products": {
      const productsColl = await getCollection(COLLECTIONS.PRODUCTS);
      const docs = rows.map(r => ({
        user_id: uId,
        name: r.name || "Unknown Product",
        sell_price: Number(r.sell_price) || 0,
        purchase_price: Number(r.cost_price) || 0,
        cost_price: Number(r.cost_price) || 0,
        stock: Number(r.in_stock) || 0,
        sku: r.sku || "",
        category: r.category || "General",
        created_at: now,
        updated_at: now
      }));
      if (docs.length > 0) await productsColl.insertMany(docs);
      break;
    }
    case "transactions": {
      const ordersColl = await getCollection(COLLECTIONS.ORDERS);
      const partiesColl = await getCollection(COLLECTIONS.PARTIES);
      
      const existingParties = await partiesColl.find({ user_id: uId }).toArray();
      const partyMap = new Map(existingParties.map(p => [p.name, p._id]));
      const newPartiesToInsert = new Map();

      for (const r of rows) {
        let partyName = r.party_name ? String(r.party_name).trim() : "";
        if (partyName && !partyMap.has(partyName) && !newPartiesToInsert.has(partyName)) {
          newPartiesToInsert.set(partyName, {
            user_id: uId, name: partyName, type: "customer", balance: 0, created_at: now, updated_at: now
          });
        }
      }

      if (newPartiesToInsert.size > 0) {
        const inserted = await partiesColl.insertMany(Array.from(newPartiesToInsert.values()));
        let i = 0;
        for (const name of newPartiesToInsert.keys()) {
          partyMap.set(name, inserted.insertedIds[i++]);
        }
      }

      const pmColl = await getCollection(COLLECTIONS.PAYMENT_METHODS);
      let defaultPmId = null;
      try {
        let defaultPm = await pmColl.findOne({ user_id: uId, name: /cash/i });
        if (!defaultPm) defaultPm = await pmColl.findOne({ user_id: uId });
        if (defaultPm) defaultPmId = defaultPm._id;
      } catch (e) {}

      const orderDocs = rows.map((r, index) => {
        const partyName = r.party_name ? String(r.party_name).trim() : "";
        const txnDate = r.date ? new Date(r.date) : now;
        const total = Number(r.total_amount) || Number(r.total) || 0;
        const discountAmt = Number(r.discount) || 0;
        const subtotal = Number(r.subtotal) || (total + discountAmt) || 0;

        return {
          user_id: uId,
          customer_id: partyName ? partyMap.get(partyName) : null,
          total_amount: total,
          subtotal: subtotal,
          invoice_no: (r.invoice_no && String(r.invoice_no).trim() !== "") ? String(r.invoice_no) : `INV-${Date.now()}-${index}`,
          sale_date: txnDate,
          due_date: null,
          charges: [],
          overallDiscount: discountAmt,
          shippingCharges: Number(r.shippingCharges) || 0,
          customer_notes: "Imported via Universal Import",
          items: [
            {
              product_id: null,
              name: r.product_name || "Imported Item",
              description: "",
              quantity: Number(r.quantity) || 1,
              quantity_str: String(Number(r.quantity) || 1),
              quantityType: "prime",
              price: Number(r.price) || 0,
              discount: 0,
              discountType: "value",
              unit_of_measurement: "pc",
              cost_price: 0
            }
          ],
          payment: {
            method: defaultPmId,
            paid_amount: total,
            paid_date: txnDate,
            no_payment_at_all: total === 0,
            user_id: uId,
            status: "completed",
            created_at: now,
            updated_at: now
          },
          status: "completed",
          created_at: now,
          updated_at: now
        };
      });
      
      if (orderDocs.length > 0) await ordersColl.insertMany(orderDocs);
      break;
    }
    case "expenses": {
      const expensesColl = await getCollection(COLLECTIONS.EXPENSES);
      const docs = rows.map(r => ({
        user_id: uId,
        expense_number: r.expense_number || `EXP-${Date.now()}-${Math.floor(Math.random()*10000)}`,
        date: r.date ? new Date(r.date) : now,
        category: r.category || "General",
        item_name: r.item_name || "Imported Expense",
        qty: Number(r.qty) || 1,
        rate: Number(r.rate) || Number(r.amount) || 0,
        amount: Number(r.amount) || 0,
        created_at: now,
        updated_at: now
      }));
      if (docs.length > 0) await expensesColl.insertMany(docs);
      break;
    }
    case "payment_methods": {
      const pmColl = await getCollection(COLLECTIONS.PAYMENT_METHODS);
      const docs = rows.map(r => ({
        user_id: uId,
        name: r.name || "Cash",
        opening_balance: Number(r.opening_balance) || 0,
        bank_name: r.bank_name || "",
        account_number: r.account_number || "",
        iban: r.iban || "",
        created_at: now,
        updated_at: now
      }));
      if (docs.length > 0) {
        try { await pmColl.insertMany(docs, { ordered: false }); } catch (e) {} // ordered: false ignores duplicates
      }
      break;
    }
    case "payments": {
      const ptColl = await getCollection(COLLECTIONS.PARTY_TRANSACTIONS);
      const partiesColl = await getCollection(COLLECTIONS.PARTIES);
      const pmColl = await getCollection(COLLECTIONS.PAYMENT_METHODS);
      
      const existingParties = await partiesColl.find({ user_id: uId }).toArray();
      const partyMap = new Map(existingParties.map(p => [p.name, p._id]));
      const newPartiesToInsert = new Map();
      
      let defaultPmId = null;
      try {
        let defaultPm = await pmColl.findOne({ user_id: uId, name: /cash/i });
        if (!defaultPm) {
          defaultPm = await pmColl.findOne({ user_id: uId }); // Fallback to any PM
        }
        if (defaultPm) defaultPmId = defaultPm._id;
      } catch (e) {}

      for (const r of rows) {
        let partyName = r.party_name ? String(r.party_name).trim() : "";
        if (partyName && !partyMap.has(partyName) && !newPartiesToInsert.has(partyName)) {
          newPartiesToInsert.set(partyName, {
            user_id: uId, name: partyName, type: "customer", balance: 0, created_at: now, updated_at: now
          });
        }
      }

      if (newPartiesToInsert.size > 0) {
        const inserted = await partiesColl.insertMany(Array.from(newPartiesToInsert.values()));
        let i = 0;
        for (const name of newPartiesToInsert.keys()) {
          partyMap.set(name, inserted.insertedIds[i++]);
        }
      }

      const paymentDocs = rows.map(r => {
        const partyName = r.party_name ? String(r.party_name).trim() : "";
        return {
          user_id: uId,
          customer_id: partyName ? partyMap.get(partyName) : null,
          customer_name: partyName || null,
          payment_amount: Number(r.payment_amount) || 0,
        date: r.date ? new Date(r.date) : now,
        type: r.type === "payment-out" ? "payment-out" : "payment-in",
        payment_method_id: defaultPmId,
        created_at: now,
        updated_at: now
      };
      });
      
      if (paymentDocs.length > 0) await ptColl.insertMany(paymentDocs);
      break;
    }
  }
}

export async function POST(req: NextRequest) {
  console.log("[API/UniversalImport] ===================== STARTING IMPORT PROCESS =====================");
  try {
    const user = await getCurrentUser();
    console.log(`[API/UniversalImport] Current user ID: ${user?.id || "unauthenticated"}`);
    if (!user) {
      console.warn("[API/UniversalImport] Unauthorized attempt");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[API/UniversalImport] Reading formData from request...");
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const isDirectImport = formData.get("directImport") === "true";
    if (!file) {
      console.warn("[API/UniversalImport] No file found in formData");
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    console.log(`[API/UniversalImport] File received: name="${file.name}", size=${file.size} bytes, type="${file.type}"`);

    console.log("[API/UniversalImport] Converting file to Buffer...");
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // 1. Parsing Logic
    console.log("[API/UniversalImport] Attempting to parse file data...");
    let datasets = await parseBuffer(buffer, file.name);

    console.log(`[API/UniversalImport] Total valid datasets extracted: ${datasets.length}`);
    if (datasets.length === 0) {
      console.warn("[API/UniversalImport] No valid tabular data found in the file.");
      return NextResponse.json({ error: "Could not parse any valid tabular data from the file" }, { status: 400 });
    }

    // 2. AI Mapping Setup
    console.log("[API/UniversalImport] Initializing AI models (OpenRouter)...");
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY || "",
    });
    const model = openrouter(process.env.OPENROUTER_MODEL || "gpt-4o-mini");

    const zip = new AdmZip();
    let processedCount = 0;
    let importedCounts: Record<string, number> = {};

    // 3. Process Each Dataset
    console.log("[API/UniversalImport] Beginning AI mapping for datasets...");
    for (const dataset of datasets) {
      console.log(`\n[API/UniversalImport] --- Processing dataset: "${dataset.name}" (${dataset.data.length} rows) ---`);
      const sample = dataset.data.slice(0, 3);
      console.log(`[API/UniversalImport] Sampling top ${sample.length} rows for AI:`, JSON.stringify(sample));
      
      const prompt = `You are an expert data migration AI mapping legacy software exports to the Dukan Khata system.
Analyze this sample data from a file/table named "${dataset.name}".
Determine which module it best fits and map the keys.

Target Schemas:
- parties: name, phone, company_name, company_address, balance (MUST be negative for Vendor/Payable, positive for Customer/Receivable)
- products: name, sell_price, cost_price, in_stock, sku, category
- transactions: invoice_no, party_name, date, product_name, quantity, price, discount, total, subtotal, overallDiscount, shippingCharges, total_amount
- payments: party_name, payment_amount, payment_method, date, type (must be 'payment-in' or 'payment-out')
- expenses: expense_number, date, category, item_name, qty, rate, amount
- sale_return: party_name, date, payment_method, total_amount, item_name, quantity, rate, amount
- staff: name, email, role_name
- payment_methods: name, opening_balance, bank_name, account_number, iban

Sample Data:
${JSON.stringify(sample, null, 2)}

Return a mapping rule. ALWAYS map FROM the Legacy Key (the key in the Sample Data) TO the Dukan Khata Target Schema key.
Example: { "ClientName": "name", "OutStanding": "balance", "Date": "date" }
If the data is garbage or doesn't fit any module, return moduleType "unknown".`;

      let object: any = { moduleType: "unknown" };
      try {
        console.log(`[API/UniversalImport] Sending prompt to AI for dataset "${dataset.name}"...`);
        const response = await generateObject({
          model,
          schema: z.object({
            moduleType: z.enum([
              "parties", "products", "transactions", "payments", 
              "expenses", "sale_return", "staff", "payment_methods", "unknown"
            ]),
            keyMapping: z.record(z.string(), z.string()).describe("Map legacy key to Dukan Khata target key. E.g. { 'ClientName': 'name', 'OutStanding': 'balance' }"),
            needsNegation: z.array(z.string()).describe("List of legacy keys whose values should be multiplied by -1 (e.g. for converting payable balances to negative)").optional()
          }),
          prompt,
        });
        object = response.object;
      } catch (aiError) {
        console.warn(`[API/UniversalImport] AI Mapping failed for dataset "${dataset.name}":`, aiError);
        continue; // Skip to next dataset on AI failure
      }
      console.log(`[API/UniversalImport] AI response for "${dataset.name}":`, JSON.stringify(object, null, 2));

      if (object.moduleType === "unknown" || !object.keyMapping) {
        console.warn(`[API/UniversalImport] AI marked dataset "${dataset.name}" as unknown or provided no mapping. Skipping.`);
        continue;
      }

      // 4. Apply Mapping to all rows in Javascript locally (Fast & Free)
      console.log(`[API/UniversalImport] Applying mapping to ${dataset.data.length} rows for module: ${object.moduleType}...`);
      
      const sampleRow = dataset.data[0] || {};
      const mappingEntries = Object.entries(object.keyMapping);
      let isInverted = false;
      
      // Determine if AI inverted the mapping (i.e. Target -> Legacy)
      if (mappingEntries.length > 0) {
        const [key1, key2] = mappingEntries[0];
        // If key1 is NOT in the row, but key2 IS in the row, the AI definitely inverted it.
        if (sampleRow[key1] === undefined && sampleRow[key2 as string] !== undefined) {
          isInverted = true;
          console.warn(`[API/UniversalImport] Detected inverted AI mapping! Flipping keys...`);
        }
      }

      const mappedRows = dataset.data.map((row) => {
        const newRow: any = {};
        for (const [keyA, keyB] of mappingEntries) {
          const legacyKey = isInverted ? (keyB as string) : keyA;
          const targetKey = isInverted ? keyA : (keyB as string);

          let val = row[legacyKey];
          
          if (object.needsNegation?.includes(legacyKey) && !isNaN(Number(val))) {
            val = Number(val) * -1;
          }
          
          // In case the AI used a static string value like "'payment-in'" instead of mapping a key
          if (val === undefined && String(legacyKey).startsWith("'") && String(legacyKey).endsWith("'")) {
             val = String(legacyKey).replace(/'/g, "");
          } else if (val === undefined && String(keyB).startsWith("'") && String(keyB).endsWith("'")) {
             val = String(keyB).replace(/'/g, "");
          }

          newRow[targetKey] = val;
        }
        return newRow;
      });

      // 5. Convert to CSV String or Direct DB Import
      if (mappedRows.length > 0) {
        if (isDirectImport) {
          console.log(`[API/UniversalImport] Directly importing ${mappedRows.length} rows to DB for module: ${object.moduleType}...`);
          try {
            await handleDirectImport(mappedRows, object.moduleType, user.id);
            importedCounts[object.moduleType] = (importedCounts[object.moduleType] || 0) + mappedRows.length;
            processedCount++;
          } catch (importErr) {
            console.error(`[API/UniversalImport] Failed to directly import module ${object.moduleType}:`, importErr);
          }
        } else {
          console.log(`[API/UniversalImport] Converting mapped rows to CSV format for dataset "${dataset.name}"...`);
          const worksheet = XLSX.utils.json_to_sheet(mappedRows);
          const csvString = XLSX.utils.sheet_to_csv(worksheet);
          const fileName = `${object.moduleType}_${dataset.name}.csv`;
          console.log(`[API/UniversalImport] Adding file "${fileName}" to ZIP archive.`);
          zip.addFile(fileName, Buffer.from(csvString, "utf8"));
          processedCount++;
        }
      }
    }

    console.log(`\n[API/UniversalImport] Processing complete. Total datasets mapped and added to ZIP: ${processedCount}`);
    if (processedCount === 0) {
      console.warn("[API/UniversalImport] Failed to map any data to existing modules. Returning 400.");
      return NextResponse.json({ error: "AI could not map any data to our modules." }, { status: 400 });
    }

    // 6. Return ZIP file or Direct Import Success
    if (isDirectImport) {
      console.log("[API/UniversalImport] Successfully finished direct database import.");
      console.log("[API/UniversalImport] ===================== IMPORT PROCESS FINISHED =====================");
      return NextResponse.json({ success: true, importedCounts }, { status: 200 });
    } else {
      console.log("[API/UniversalImport] Compiling final ZIP buffer...");
      const zipBuffer = zip.toBuffer();
      
      console.log("[API/UniversalImport] Successfully sending ZIP file to client. (Size:", zipBuffer.length, "bytes)");
      console.log("[API/UniversalImport] ===================== IMPORT PROCESS FINISHED =====================");
      return new NextResponse(zipBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename=DukanKhata_Migration.zip`,
        },
      });
    }

  } catch (error: any) {
    console.error("[API/UniversalImport] FATAL ERROR during import process:");
    console.error(error);
    return NextResponse.json({ error: error.message || "Server Error" }, { status: 500 });
  }
}
