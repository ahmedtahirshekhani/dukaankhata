import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/utils";
import * as XLSX from "xlsx";
import AdmZip from "adm-zip";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject } from "ai";
import { z } from "zod";

export const maxDuration = 60; // Increase Vercel function timeout if applicable

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let datasets: { name: string; data: any[] }[] = [];

    // 1. Parsing Logic
    try {
      // Try Excel / CSV parsing first (Handles multiple sheets well)
      const workbook = XLSX.read(buffer, { type: "buffer" });
      workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        if (jsonData.length > 0) {
          datasets.push({ name: sheetName, data: jsonData });
        }
      });
    } catch (excelError) {
      // Try JSON if Excel fails
      try {
        const text = buffer.toString("utf-8");
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          datasets.push({ name: "data", data: parsed });
        } else if (typeof parsed === "object") {
          // If it's a dictionary of tables
          for (const [key, value] of Object.entries(parsed)) {
            if (Array.isArray(value) && value.length > 0) {
              datasets.push({ name: key, data: value });
            }
          }
        }
      } catch (jsonError) {
        // Fallback: Extremely basic SQL INSERT parsing
        const text = buffer.toString("utf-8");
        const insertRegex = /INSERT INTO `?(\w+)`? \((.*?)\) VALUES \((.*?)\);/gi;
        let match;
        const sqlTables: Record<string, any[]> = {};
        while ((match = insertRegex.exec(text)) !== null) {
          const tableName = match[1];
          const cols = match[2].split(",").map(c => c.trim().replace(/`/g, ''));
          // Extremely naive split (does not handle commas inside strings well, but serves as simple fallback)
          const vals = match[3].split(",").map(v => v.trim().replace(/^'|'$/g, ''));
          
          if (!sqlTables[tableName]) sqlTables[tableName] = [];
          
          const rowObj: any = {};
          cols.forEach((col, i) => {
            rowObj[col] = vals[i] ?? "";
          });
          sqlTables[tableName].push(rowObj);
        }
        
        for (const [tName, tData] of Object.entries(sqlTables)) {
          if (tData.length > 0) datasets.push({ name: tName, data: tData });
        }
      }
    }

    if (datasets.length === 0) {
      return NextResponse.json({ error: "Could not parse any valid tabular data from the file" }, { status: 400 });
    }

    // 2. AI Mapping Setup
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY || "",
    });
    const model = openrouter(process.env.OPENROUTER_MODEL || "gpt-4o-mini");

    const zip = new AdmZip();
    let processedCount = 0;

    // 3. Process Each Dataset
    for (const dataset of datasets) {
      // Sample 3 rows for AI to determine mapping
      const sample = dataset.data.slice(0, 3);
      
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

Return a mapping rule. If the data is garbage or doesn't fit any module, return moduleType "unknown".`;

      const { object } = await generateObject({
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

      if (object.moduleType === "unknown" || !object.keyMapping) continue;

      // 4. Apply Mapping to all rows in Javascript locally (Fast & Free)
      const mappedRows = dataset.data.map((row) => {
        const newRow: any = {};
        for (const [legacyKey, targetKey] of Object.entries(object.keyMapping)) {
          let val = row[legacyKey];
          
          if (object.needsNegation?.includes(legacyKey) && !isNaN(Number(val))) {
            val = Number(val) * -1;
          }
          
          newRow[targetKey] = val;
        }
        return newRow;
      });

      // 5. Convert to CSV String
      if (mappedRows.length > 0) {
        const worksheet = XLSX.utils.json_to_sheet(mappedRows);
        const csvString = XLSX.utils.sheet_to_csv(worksheet);
        zip.addFile(`${object.moduleType}_${dataset.name}.csv`, Buffer.from(csvString, "utf8"));
        processedCount++;
      }
    }

    if (processedCount === 0) {
      return NextResponse.json({ error: "AI could not map any data to our modules." }, { status: 400 });
    }

    // 6. Return ZIP file
    const zipBuffer = zip.toBuffer();
    
    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename=DukanKhata_Migration.zip`,
      },
    });

  } catch (error: any) {
    console.error("Universal Import Error:", error);
    return NextResponse.json({ error: error.message || "Server Error" }, { status: 500 });
  }
}
