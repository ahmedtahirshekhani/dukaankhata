// // // import { NextRequest, NextResponse } from "next/server";
// // // import fs from "fs";
// // // import path from "path";
// // // import os from "os";
// // // import AdmZip from "adm-zip";
// // // import sqlite3 from "sqlite3";
// // // import { open, Database } from "sqlite";

// // // import { getCurrentUser } from "@/lib/auth/utils";
// // // import {
// // //   getCollection,
// // //   COLLECTIONS,
// // //   toObjectId,
// // //   isValidObjectId,
// // // } from "@/lib/db/mongodb";
// // // import {
// // //   appendCustomerLedgerEntry,
// // //   appendPartyLedgerEntry,
// // //   seedCustomerOpeningBalance,
// // // } from "@/lib/ledger/customer-ledger";
// // // import { setDateToCurrentTime } from "@/lib/utils";

// // // export const runtime = "nodejs";
// // // export const dynamic = "force-dynamic";

// // // type AnyRow = Record<string, any>;

// // // // ======================== UTILITY FUNCTIONS ========================

// // // function qIdent(name: string) {
// // //   return `"${String(name).replace(/"/g, '""')}"`;
// // // }

// // // function lower(v: unknown): string {
// // //   return String(v ?? "").trim().toLowerCase();
// // // }

// // // function str(v: unknown, fallback = ""): string {
// // //   const s = v === null || v === undefined ? "" : String(v);
// // //   return s.trim() || fallback;
// // // }

// // // function num(v: unknown, fallback = 0): number {
// // //   const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
// // //   return Number.isFinite(n) ? n : fallback;
// // // }

// // // function firstValue(row: AnyRow, keys: string[], fallback = ""): string {
// // //   for (const key of keys) {
// // //     const val = row[key];
// // //     if (val !== undefined && val !== null && String(val).trim() !== "") {
// // //       return String(val).trim();
// // //     }
// // //   }
// // //   return fallback;
// // // }

// // // function firstNumber(row: AnyRow, keys: string[], fallback = 0): number {
// // //   for (const key of keys) {
// // //     const val = row[key];
// // //     if (val !== undefined && val !== null && String(val).trim() !== "") {
// // //       const n = num(val, NaN);
// // //       if (Number.isFinite(n)) return n;
// // //     }
// // //   }
// // //   return fallback;
// // // }

// // // function parseDateValue(value: unknown): Date {
// // //   if (value instanceof Date) return value;
// // //   if (typeof value === "number" && Number.isFinite(value)) {
// // //     const ms = value > 10_000_000_000 ? value : value * 1000;
// // //     const d = new Date(ms);
// // //     if (!isNaN(d.getTime())) return d;
// // //   }
// // //   const s = String(value ?? "").trim();
// // //   if (!s) return new Date();
// // //   const numeric = Number(s);
// // //   if (Number.isFinite(numeric)) {
// // //     const ms = numeric > 10_000_000_000 ? numeric : numeric * 1000;
// // //     const d = new Date(ms);
// // //     if (!isNaN(d.getTime())) return d;
// // //   }
// // //   const d = new Date(s);
// // //   if (!isNaN(d.getTime())) return d;
// // //   return new Date();
// // // }

// // // function makeExternalId(table: string, row: AnyRow, fallbackIndex: number) {
// // //   const possible = row.id ?? row._id ?? row.pk ?? row.uuid ?? row.key ?? row.name ?? row.full_name ?? row.item_name;
// // //   return `${table}:${possible ?? fallbackIndex}`;
// // // }

// // // async function listTables(db: Database) {
// // //   const rows = await db.all<AnyRow[]>(
// // //     `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
// // //   );
// // //   return rows.map((r) => String(r.name));
// // // }

// // // async function readAll(db: Database, table: string): Promise<AnyRow[]> {
// // //   try {
// // //     return await db.all<AnyRow[]>(`SELECT * FROM ${qIdent(table)}`);
// // //   } catch (error) {
// // //     console.error(`Error reading table ${table}:`, error);
// // //     return [];
// // //   }
// // // }

// // // async function tableColumns(db: Database, table: string): Promise<string[]> {
// // //   try {
// // //     const cols = await db.all<AnyRow[]>(`PRAGMA table_info(${qIdent(table)})`);
// // //     return cols.map((c) => String(c.name));
// // //   } catch {
// // //     return [];
// // //   }
// // // }

// // // // ======================== TABLE DETECTION (UPDATED FOR VYAPAR SCHEMA) ========================

// // // async function detectTables(db: Database) {
// // //   const tables = await listTables(db);
// // //   console.log(`📋 Total tables found: ${tables.length}`);
// // //   console.log("Table names:", tables);

// // //   const result = {
// // //     partyTable: null as string | null,
// // //     productTable: null as string | null,
// // //     paymentMethodTable: null as string | null,
// // //     transactionTables: [] as string[],
// // //     lineItemTables: [] as string[],
// // //     expenseTable: null as string | null,
// // //   };

// // //   for (const table of tables) {
// // //     const cols = await tableColumns(db, table);
// // //     const colSet = new Set(cols.map(c => c.toLowerCase()));
// // //     console.log(`\n🔍 Checking table: ${table}`);
// // //     console.log(`   Columns: ${cols.join(", ")}`);

// // //     if (!result.partyTable && (
// // //       (colSet.has('full_name') && (colSet.has('phone_number') || colSet.has('email'))) ||
// // //       (colSet.has('name') && (colSet.has('phone') || colSet.has('email') || colSet.has('opening_balance'))) ||
// // //       (colSet.has('name') && colSet.has('phone') && colSet.has('address'))
// // //     )) {
// // //       result.partyTable = table;
// // //       console.log(`   ✅ Detected as PARTY table`);
// // //       continue;
// // //     }

// // //     if (!result.productTable && (
// // //       (colSet.has('item_name') && (colSet.has('item_sale_unit_price') || colSet.has('item_purchase_unit_price'))) ||
// // //       (colSet.has('name') && (colSet.has('sale_price') || colSet.has('purchase_price') || colSet.has('quantity')))
// // //     )) {
// // //       result.productTable = table;
// // //       console.log(`   ✅ Detected as PRODUCT table`);
// // //       continue;
// // //     }

// // //     if (!result.paymentMethodTable && (
// // //       (colSet.has('paymenttype_name') && colSet.has('paymenttype_type')) ||
// // //       colSet.has('bank_name') ||
// // //       (colSet.has('account_number') && colSet.has('ifsc_code'))
// // //     )) {
// // //       result.paymentMethodTable = table;
// // //       console.log(`   ✅ Detected as PAYMENT METHOD table`);
// // //       continue;
// // //     }

// // //     if (!result.expenseTable && (
// // //       colSet.has('expense_number') ||
// // //       (colSet.has('category') && colSet.has('amount') && !colSet.has('product_id'))
// // //     )) {
// // //       result.expenseTable = table;
// // //       console.log(`   ✅ Detected as EXPENSE table`);
// // //       continue;
// // //     }

// // //     if (colSet.has('quantity') && (colSet.has('item_id') || colSet.has('product_id') || colSet.has('lineitem_txn_id'))) {
// // //       result.lineItemTables.push(table);
// // //       console.log(`   ✅ Detected as LINE ITEM table`);
// // //       continue;
// // //     }

// // //     if ((colSet.has('txn_date') || colSet.has('date')) && 
// // //         (colSet.has('txn_cash_amount') || colSet.has('txn_balance_amount') || colSet.has('total_amount')) &&
// // //         (colSet.has('txn_name_id') || colSet.has('party_id') || colSet.has('customer_id'))) {
// // //       result.transactionTables.push(table);
// // //       console.log(`   ✅ Detected as TRANSACTION table`);
// // //       continue;
// // //     }
// // //   }

// // //   console.log("\n📊 DETECTION SUMMARY:");
// // //   console.log(`   Party table: ${result.partyTable}`);
// // //   console.log(`   Product table: ${result.productTable}`);
// // //   console.log(`   Payment method table: ${result.paymentMethodTable}`);
// // //   console.log(`   Expense table: ${result.expenseTable}`);
// // //   console.log(`   Transaction tables: ${result.transactionTables.join(", ") || "(none)"}`);
// // //   console.log(`   Line item tables: ${result.lineItemTables.join(", ") || "(none)"}`);

// // //   return result;
// // // }

// // // // ======================== DATA MAPPING & UPSERT (FIXED) ========================

// // // async function upsertPartyFromRow(
// // //   partiesCollection: Awaited<ReturnType<typeof getCollection>>,
// // //   userId: string,
// // //   table: string,
// // //   row: AnyRow,
// // //   index: number,
// // // ) {
// // //   const externalId = makeExternalId(table, row, index);
// // //   const name = firstValue(row, ["full_name", "name", "party_name", "customer_name", "account_name", "title", "ledger_name"]);
// // //   if (!name) return null;

// // //   const phone = firstValue(row, ["phone_number", "phone", "mobile", "contact"]);
// // //   const email = firstValue(row, ["email", "mail"]);
// // //   const openingBalance = firstNumber(row, ["amount", "opening_balance", "openingBalance", "balance", "current_balance"], 0);

// // //   const userObjId = toObjectId(userId);

// // //   const result = await partiesCollection.updateOne(
// // //     { user_id: userObjId, external_source: "vyapar", external_id: externalId },
// // //     {
// // //       $set: {
// // //         name: name,
// // //         email: email,
// // //         phone: phone,
// // //         company_name: firstValue(row, ["company_name", "firm_name", "business_name"], ""),
// // //         company_address: firstValue(row, ["company_address", "address", "billing_address"], ""),
// // //         status: firstValue(row, ["status"], "active") || "active",
// // //         is_delete: 0,
// // //         updated_at: new Date(),
// // //       },
// // //       $setOnInsert: {
// // //         user_id: userObjId,
// // //         opening_balance: openingBalance,
// // //         external_source: "vyapar",
// // //         external_id: externalId,
// // //         source_table: table,
// // //         source_row_id: str(row.id ?? row._id ?? row.name_id ?? index),
// // //         created_at: new Date(),
// // //       },
// // //     },
// // //     { upsert: true }
// // //   );

// // //   const saved = await partiesCollection.findOne({ user_id: userObjId, external_source: "vyapar", external_id: externalId });
// // //   if (result.upsertedId && saved?._id && openingBalance !== 0) {
// // //     await seedCustomerOpeningBalance(userId, saved._id.toString(), openingBalance, parseDateValue(row.date ?? row.created_at ?? new Date()));
// // //   }
// // //   return saved;
// // // }

// // // async function upsertProductFromRow(
// // //   productsCollection: Awaited<ReturnType<typeof getCollection>>,
// // //   userId: string,
// // //   table: string,
// // //   row: AnyRow,
// // //   index: number,
// // // ) {
// // //   const externalId = makeExternalId(table, row, index);
// // //   const name = firstValue(row, ["item_name", "name", "product_name", "title", "item"]);
// // //   if (!name) return null;

// // //   const salePrice = firstNumber(row, ["item_sale_unit_price", "sale_price", "sell_price", "mrp", "rate"], 0);
// // //   const purchasePrice = firstNumber(row, ["item_purchase_unit_price", "purchase_price", "cost_price", "buy_price"], 0);
// // //   const quantity = firstNumber(row, ["item_stock_quantity", "quantity", "qty", "stock", "in_stock"], 0);

// // //   const userObjId = toObjectId(userId);

// // //   await productsCollection.updateOne(
// // //     { user_id: userObjId, external_source: "vyapar", external_id: externalId },
// // //     {
// // //       $set: {
// // //         name: name,
// // //         type: firstValue(row, ["item_type", "type"], "goods") || "goods",
// // //         category: firstValue(row, ["category_id", "category", "group"], ""),
// // //         description: firstValue(row, ["item_description", "description", "remarks"], ""),
// // //         unit_of_measurement: firstValue(row, ["unit_name", "unit", "uom"], ""),
// // //         sale_price: salePrice,
// // //         purchase_price: purchasePrice,
// // //         quantity: quantity,
// // //         in_stock: quantity,
// // //         stock: quantity,
// // //         damaged_quantity: 0,
// // //         barcode: firstValue(row, ["item_code", "barcode", "sku", "hsn"], ""),
// // //         updated_at: new Date(),
// // //       },
// // //       $setOnInsert: {
// // //         user_id: userObjId,
// // //         external_source: "vyapar",
// // //         external_id: externalId,
// // //         source_table: table,
// // //         source_row_id: str(row.id ?? row._id ?? row.item_id ?? index),
// // //         created_at: new Date(),
// // //       },
// // //     },
// // //     { upsert: true }
// // //   );

// // //   return productsCollection.findOne({ user_id: userObjId, external_source: "vyapar", external_id: externalId });
// // // }

// // // async function upsertPaymentMethodFromRow(
// // //   paymentMethodCollection: Awaited<ReturnType<typeof getCollection>>,
// // //   userId: string,
// // //   table: string,
// // //   row: AnyRow,
// // //   index: number,
// // // ) {
// // //   const externalId = makeExternalId(table, row, index);
// // //   const bankName = firstValue(row, ["paymenttype_name", "bank_name", "name", "title", "account_name"], "");
// // //   if (!bankName) {
// // //     console.log(`   ⚠️ Payment method row ${index}: no bank name, skipping`);
// // //     return null;
// // //   }

// // //   const userObjId = toObjectId(userId);

// // //   const result = await paymentMethodCollection.updateOne(
// // //     { user_id: userObjId, external_source: "vyapar", external_id: externalId },
// // //     {
// // //       $set: {
// // //         bank_name: bankName,
// // //         account_number: firstValue(row, ["paymenttype_accountnumber", "account_number", "acc_no"], ""),
// // //         ifsc_code: firstValue(row, ["pt_bank_ifsc_code", "ifsc_code", "ifsc"], ""),
// // //         branch_name: firstValue(row, ["branch_name", "branch"], ""),
// // //         type: firstValue(row, ["paymenttype_type", "type", "method_type"], ""),
// // //         updated_at: new Date(),
// // //       },
// // //       $setOnInsert: {
// // //         user_id: userObjId,
// // //         external_source: "vyapar",
// // //         external_id: externalId,
// // //         source_table: table,
// // //         source_row_id: str(row.id ?? row._id ?? row.paymentType_id ?? index),
// // //         created_at: new Date(),
// // //       },
// // //     },
// // //     { upsert: true }
// // //   );

// // //   if (result.upsertedId) {
// // //     console.log(`   ✅ Payment method inserted: ${bankName}`);
// // //   } else {
// // //     console.log(`   ✅ Payment method updated: ${bankName}`);
// // //   }

// // //   return paymentMethodCollection.findOne({ user_id: userObjId, external_source: "vyapar", external_id: externalId });
// // // }

// // // function mapPaymentMethodId(row: AnyRow, paymentMethodDocs: AnyRow[]) {
// // //   const raw = row.payment_method_id ?? row.payment_method ?? row.method ?? row.bank_name ?? row.account_name ?? row.paymentMode ?? row.payment_mode ?? row.paymenttype_name ?? "";
// // //   const v = str(raw);
// // //   if (!v) return null;
// // //   const lowerV = v.toLowerCase();
// // //   if (lowerV === "cash" || lowerV === "cheque") return lowerV;
// // //   const found = paymentMethodDocs.find((pm) => lower(pm.bank_name) === lowerV || lower(pm.external_id) === lowerV);
// // //   return found?._id ? found._id.toString() : null;
// // // }

// // // function buildOrderItemsFromLineRows(lineRows: AnyRow[], productDocs: AnyRow[]) {
// // //   return lineRows.map((line) => {
// // //     const productName = firstValue(line, ["item_name", "product_name", "name", "title"], "");
// // //     const productIdRaw = firstValue(line, ["item_id", "product_id", "goods_id"], "");
// // //     const qty = firstNumber(line, ["quantity", "qty", "count"], 0);
// // //     const price = firstNumber(line, ["priceperunit", "price", "rate", "sale_price", "unit_price"], 0);
// // //     const discount = firstNumber(line, ["lineitem_discount_amount", "discount"], 0);
// // //     const discountType = firstValue(line, ["discount_type"], "value") || "value";
// // //     const uom = firstValue(line, ["unit_name", "unit_of_measurement", "uom", "unit"], "");

// // //     const matchedProduct = productDocs.find((p) => {
// // //       const idStr = p._id?.toString?.() ?? "";
// // //       const ext = lower(p.external_id);
// // //       return (productIdRaw && idStr === productIdRaw) || (productName && lower(p.name) === lower(productName)) || (productIdRaw && ext === lower(productIdRaw));
// // //     }) ?? null;

// // //     return {
// // //       product_id: matchedProduct?._id ? matchedProduct._id : (isValidObjectId(productIdRaw) ? toObjectId(productIdRaw) : null),
// // //       name: productName || matchedProduct?.name || "",
// // //       description: firstValue(line, ["lineitem_description", "description", "remarks"], matchedProduct?.description || ""),
// // //       quantity: qty,
// // //       quantityType: firstValue(line, ["quantityType"], "prime") || "prime",
// // //       price,
// // //       discount,
// // //       discountType,
// // //       unit_of_measurement: uom || matchedProduct?.unit_of_measurement || "",
// // //     };
// // //   });
// // // }

// // // async function getLineRowsForMaster(db: Database, lineTables: string[], masterRow: AnyRow) {
// // //   const masterId = masterRow.id ?? masterRow._id ?? masterRow.txn_id ?? masterRow.transaction_id ?? masterRow.bill_id ?? masterRow.sale_id ?? masterRow.purchase_id ?? masterRow.voucher_id;
// // //   if (masterId === undefined || masterId === null) return [];

// // //   const idStr = String(masterId);
// // //   for (const table of lineTables) {
// // //     const rows = await readAll(db, table);
// // //     const columns = rows[0] ? Object.keys(rows[0]) : await tableColumns(db, table);
// // //     const fkCandidates = ["lineitem_txn_id", "txn_id", "transaction_id", "order_id", "bill_id", "purchase_id", "sale_id", "master_id", "parent_id", "voucher_id"];
// // //     const fk = fkCandidates.find((c) => columns.map((x) => x.toLowerCase()).includes(c.toLowerCase()));
// // //     if (!fk) continue;
// // //     const filtered = rows.filter((r) => String(r[fk]) === idStr);
// // //     if (filtered.length > 0) return filtered;
// // //   }
// // //   return [];
// // // }

// // // function classifyTransaction(row: AnyRow): "sale" | "purchase" | "payment_in" | "payment_out" | "expense" | "unknown" {
// // //   const t = lower(row.txn_type ?? row.type ?? row.transaction_type ?? row.voucher_type ?? row.kind ?? row.entry_type ?? row.category);
// // //   if (t.includes("sale") || t.includes("invoice") || t.includes("sell") || t.includes("outward")) return "sale";
// // //   if (t.includes("purchase") || t.includes("buy") || t.includes("inward")) return "purchase";
// // //   if (t.includes("receipt") || t.includes("payment in") || t.includes("payment-in") || t.includes("collection") || t.includes("received")) return "payment_in";
// // //   if (t.includes("payment out") || t.includes("payment-out") || t.includes("paid") || t.includes("expense paid") || t.includes("payable")) return "payment_out";
// // //   if (t.includes("expense")) return "expense";
// // //   return "unknown";
// // // }

// // // async function importExpensesFromRows(userId: string, expenseRows: AnyRow[]) {
// // //   const expensesCollection = await getCollection(COLLECTIONS.EXPENSES);
// // //   let inserted = 0;
// // //   for (let i = 0; i < expenseRows.length; i++) {
// // //     const row = expenseRows[i];
// // //     const externalId = makeExternalId("expenses", row, i);
// // //     const expenseNumber = firstValue(row, ["expense_number", "expenseNo", "voucher_no", "bill_no", "number"], externalId);
// // //     const expenseDate = setDateToCurrentTime(firstValue(row, ["date", "expense_date", "created_at", "createdAt"], new Date().toISOString().slice(0, 10)));

// // //     const category = firstValue(row, ["category", "group", "type"], "Misc");
// // //     const itemName = firstValue(row, ["item_name", "description", "name", "title"], "Expense");
// // //     const qty = firstNumber(row, ["qty", "quantity"], 1);
// // //     const rate = firstNumber(row, ["rate", "price"], 0);
// // //     const amount = firstNumber(row, ["amount", "total"], qty * rate);

// // //     await expensesCollection.updateOne(
// // //       { user_id: toObjectId(userId), external_source: "vyapar", external_id: externalId },
// // //       {
// // //         $set: {
// // //           expense_number: expenseNumber,
// // //           date: expenseDate,
// // //           category,
// // //           item_name: itemName,
// // //           description: itemName,
// // //           qty,
// // //           rate,
// // //           amount,
// // //           updated_at: new Date(),
// // //         },
// // //         $setOnInsert: {
// // //           user_id: toObjectId(userId),
// // //           created_at: new Date(),
// // //           external_source: "vyapar",
// // //           external_id: externalId,
// // //           source_table: "expenses",
// // //           source_row_id: str(row.id ?? row._id ?? i),
// // //         },
// // //       },
// // //       { upsert: true }
// // //     );
// // //     inserted++;
// // //   }
// // //   return inserted;
// // // }

// // // // ======================== MAIN POST HANDLER ========================

// // // export async function POST(req: NextRequest) {
// // //   const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vyapar-import-"));
// // //   console.log("📁 Temp directory created:", tempDir);

// // //   let db: Database | null = null;

// // //   try {
// // //     const user = (await getCurrentUser()) as { id: string } | null;
// // //     if (!user) {
// // //       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
// // //     }
// // //     console.log("👤 User ID:", user.id);

// // //     const formData = await req.formData();
// // //     const file = formData.get("file");
// // //     if (!(file instanceof File)) {
// // //       return NextResponse.json({ error: "File is required" }, { status: 400 });
// // //     }

// // //     const fileName = file.name || "backup.vyb";
// // //     console.log("📂 Received file:", fileName);
// // //     const fileBuffer = Buffer.from(await file.arrayBuffer());
// // //     const uploadedPath = path.join(tempDir, fileName);
// // //     fs.writeFileSync(uploadedPath, fileBuffer);

// // //     let sqlitePath = uploadedPath;
// // //     if (fileName.toLowerCase().endsWith(".vyb")) {
// // //       console.log("🔓 Extracting .vyb using adm-zip...");
// // //       const zip = new AdmZip(uploadedPath);
// // //       const zipEntries = zip.getEntries();
// // //       const vypEntry = zipEntries.find(entry => entry.entryName.toLowerCase().endsWith(".vyp"));
// // //       if (!vypEntry) {
// // //         return NextResponse.json({ error: "Invalid Vyapar backup: .vyp not found inside .vyb" }, { status: 400 });
// // //       }
// // //       sqlitePath = path.join(tempDir, path.basename(vypEntry.entryName));
// // //       const vypData = vypEntry.getData();
// // //       fs.writeFileSync(sqlitePath, vypData);
// // //       console.log("✅ Extracted .vyp to:", sqlitePath);
// // //     }

// // //     console.log("🗄️ Opening SQLite database...");
// // //     db = await open({ filename: sqlitePath, driver: sqlite3.Database });

// // //     const detected = await detectTables(db);

// // //     const partiesCollection = await getCollection(COLLECTIONS.PARTIES);
// // //     const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
// // //     const paymentMethodCollection = await getCollection(COLLECTIONS.PAYMENT_METHOD);
// // //     const ordersCollection = await getCollection(COLLECTIONS.ORDERS);
// // //     const purchaseBillsCollection = await getCollection(COLLECTIONS.PURCHASE_BILLS);
// // //     const partyTransactionCollection = await getCollection(COLLECTIONS.PARTY_TRANSACTIONS);
// // //     const expensesCollection = await getCollection(COLLECTIONS.EXPENSES);

// // //     const summary = {
// // //       tables: (await listTables(db)).length,
// // //       partiesImported: 0,
// // //       productsImported: 0,
// // //       paymentMethodsImported: 0,
// // //       salesImported: 0,
// // //       purchaseBillsImported: 0,
// // //       partyTransactionsImported: 0,
// // //       expensesImported: 0,
// // //       warnings: [] as string[],
// // //     };

// // //     // 1) Parties
// // //     if (detected.partyTable) {
// // //       const rows = await readAll(db, detected.partyTable);
// // //       console.log(`👥 Importing ${rows.length} parties from ${detected.partyTable}...`);
// // //       for (let i = 0; i < rows.length; i++) {
// // //         const saved = await upsertPartyFromRow(partiesCollection, user.id, detected.partyTable, rows[i], i);
// // //         if (saved?._id) summary.partiesImported++;
// // //       }
// // //       console.log(`✅ Parties imported: ${summary.partiesImported}`);
// // //     }

// // //     // 2) Products
// // //     if (detected.productTable) {
// // //       const rows = await readAll(db, detected.productTable);
// // //       console.log(`📦 Importing ${rows.length} products from ${detected.productTable}...`);
// // //       for (let i = 0; i < rows.length; i++) {
// // //         const saved = await upsertProductFromRow(productsCollection, user.id, detected.productTable, rows[i], i);
// // //         if (saved?._id) summary.productsImported++;
// // //       }
// // //       console.log(`✅ Products imported: ${summary.productsImported}`);
// // //     }

// // //     // 3) Payment methods
// // //     let paymentMethodDocs: AnyRow[] = [];
// // //     if (detected.paymentMethodTable) {
// // //       const rows = await readAll(db, detected.paymentMethodTable);
// // //       console.log(`💳 Importing ${rows.length} payment methods from ${detected.paymentMethodTable}...`);
// // //       for (let i = 0; i < rows.length; i++) {
// // //         const saved = await upsertPaymentMethodFromRow(paymentMethodCollection, user.id, detected.paymentMethodTable, rows[i], i);
// // //         if (saved?._id) summary.paymentMethodsImported++;
// // //       }
// // //       paymentMethodDocs = await paymentMethodCollection.find({ user_id: toObjectId(user.id), external_source: "vyapar" }).toArray();
// // //       console.log(`✅ Payment methods imported: ${summary.paymentMethodsImported}`);
// // //     }

// // //     const importedProducts = await productsCollection.find({ user_id: toObjectId(user.id), external_source: "vyapar" }).toArray();
// // //     // Also fetch parties for quick lookup
// // //     const importedParties = await partiesCollection.find({ user_id: toObjectId(user.id), external_source: "vyapar" }).toArray();
// // //     const partyByExternalId = new Map<string, any>();
// // //     const partyByName = new Map<string, any>();
// // //     for (const p of importedParties) {
// // //       if (p.external_id) partyByExternalId.set(p.external_id, p);
// // //       if (p.name) partyByName.set(p.name.toLowerCase(), p);
// // //     }

// // //     // 4) Transactions
// // //     for (const txnTable of detected.transactionTables) {
// // //       const rows = await readAll(db, txnTable);
// // //       console.log(`\n📄 Processing ${rows.length} transactions from ${txnTable}...`);
      
// // //       for (let i = 0; i < rows.length; i++) {
// // //         const row = rows[i];
// // //         const kind = classifyTransaction(row);
// // //         const externalId = makeExternalId(txnTable, row, i);
// // //         const date = parseDateValue(row.txn_date ?? row.date ?? row.transaction_date ?? row.created_at);

// // //         // --- Improved party resolution ---
// // //         let partyId: string | null = null;
// // //         const partyName = firstValue(row, ["full_name", "party_name", "customer_name", "vendor_name", "name"], "");
// // //         const partyRef = row.txn_name_id; // integer ID from kb_names

// // //         if (partyRef) {
// // //           // Try to find by external_id = "kb_names:${partyRef}"
// // //           const externalIdPattern = `kb_names:${partyRef}`;
// // //           let party = partyByExternalId.get(externalIdPattern);
// // //           if (!party) {
// // //             // Try by source_row_id
// // //             party = importedParties.find(p => String(p.source_row_id) === String(partyRef));
// // //           }
// // //           if (party) partyId = party._id.toString();
// // //         }

// // //         if (!partyId && partyName) {
// // //           const lowerName = partyName.toLowerCase();
// // //           let party = partyByName.get(lowerName);
// // //           if (party) partyId = party._id.toString();
// // //         }

// // //         if (!partyId && (partyRef || partyName)) {
// // //           // Fallback: create a new party using ensurePartyByName
// // //           const newParty = await ensurePartyByName(partiesCollection, user.id, partyName || `Party_${partyRef}`, {
// // //             phone: firstValue(row, ["phone_number", "phone"], ""),
// // //             email: firstValue(row, ["email"], ""),
// // //             external_id: partyRef ? `kb_names:${partyRef}` : undefined,
// // //             source_table: txnTable,
// // //             source_row_id: str(row.id ?? row._id ?? i),
// // //           });
// // //           if (newParty) {
// // //             partyId = newParty._id.toString();
// // //             // Update local maps
// // //             partyByExternalId.set(newParty.external_id, newParty);
// // //             partyByName.set(newParty.name.toLowerCase(), newParty);
// // //           }
// // //         }

// // //         const totalAmount = firstNumber(row, ["txn_balance_amount", "total_amount", "grand_total", "amount"], 0);
// // //         const paidAmount = firstNumber(row, ["txn_cash_amount", "paid_amount", "received_amount"], 0);
// // //         const amount = totalAmount > 0 ? totalAmount : paidAmount;
// // //         const subtotal = firstNumber(row, ["subtotal", "gross_amount"], amount);
// // //         const invoiceNo = firstValue(row, ["txn_ref_number_char", "invoice_no", "bill_no", "voucher_no"], "");
// // //         const dueDateRaw = firstValue(row, ["txn_due_date", "due_date"], "");

// // //         const lineRows = await getLineRowsForMaster(db, detected.lineItemTables, row);
// // //         const orderItems = buildOrderItemsFromLineRows(lineRows, importedProducts);
// // //         const paymentMethodId = mapPaymentMethodId(row, paymentMethodDocs);

// // //         // ---- SALE ----
// // //         if (kind === "sale" || (kind === "unknown" && orderItems.length > 0 && amount > 0)) {
// // //           if (!partyId) {
// // //             summary.warnings.push(`Sale skipped at row ${i+1} in ${txnTable}: party not found`);
// // //             continue;
// // //           }

// // //           await ordersCollection.updateOne(
// // //             { user_id: toObjectId(user.id), external_source: "vyapar", external_id: externalId },
// // //             {
// // //               $set: {
// // //                 customer_id: toObjectId(partyId),
// // //                 total_amount: amount,
// // //                 subtotal,
// // //                 invoice_no: invoiceNo || null,
// // //                 sale_date: date,
// // //                 due_date: dueDateRaw ? parseDateValue(dueDateRaw) : null,
// // //                 charges: [],
// // //                 overallDiscount: firstNumber(row, ["txn_discount_amount", "overall_discount", "discount"], 0),
// // //                 shippingCharges: firstNumber(row, ["shipping_charges", "delivery_charges"], 0),
// // //                 items: orderItems,
// // //                 payment: paidAmount > 0 ? {
// // //                   method: paymentMethodId || firstValue(row, ["txn_payment_type_id", "payment_method"], "cash") || "cash",
// // //                   paid_amount: paidAmount,
// // //                   paid_date: date,
// // //                   no_payment_at_all: false,
// // //                 } : null,
// // //                 status: row.txn_status === "paid" ? "completed" : "pending",
// // //                 updated_at: new Date(),
// // //               },
// // //               $setOnInsert: {
// // //                 user_id: toObjectId(user.id),
// // //                 created_at: new Date(),
// // //                 external_source: "vyapar",
// // //                 external_id: externalId,
// // //                 source_table: txnTable,
// // //                 source_row_id: str(row.id ?? row._id ?? row.txn_id ?? i),
// // //               },
// // //             },
// // //             { upsert: true }
// // //           );
// // //           const orderDoc = await ordersCollection.findOne({ user_id: toObjectId(user.id), external_source: "vyapar", external_id: externalId });
// // //           if (orderDoc?._id) {
// // //             await appendCustomerLedgerEntry({
// // //               userId: user.id,
// // //               customerId: partyId,
// // //               eventKey: `vyapar:sale:${orderDoc._id.toString()}`,
// // //               eventType: "order_debit",
// // //               eventSource: "order",
// // //               eventSourceId: orderDoc._id.toString(),
// // //               amountDelta: amount,
// // //               effectiveAt: date,
// // //               metadata: { source: "vyapar_import", invoice_no: invoiceNo },
// // //             });
// // //             if (paidAmount > 0) {
// // //               await appendCustomerLedgerEntry({
// // //                 userId: user.id,
// // //                 customerId: partyId,
// // //                 eventKey: `vyapar:sale_payment:${orderDoc._id.toString()}`,
// // //                 eventType: "order_payment_credit",
// // //                 eventSource: "order",
// // //                 eventSourceId: orderDoc._id.toString(),
// // //                 amountDelta: -paidAmount,
// // //                 effectiveAt: date,
// // //                 metadata: { source: "vyapar_import", invoice_no: invoiceNo, payment_method_id: paymentMethodId },
// // //               });
// // //             }
// // //           }
// // //           summary.salesImported++;
// // //           continue;
// // //         }

// // //         // ---- PURCHASE ----
// // //         if (kind === "purchase" || (kind === "unknown" && txnTable.toLowerCase().includes("purchase"))) {
// // //           if (!partyId) {
// // //             summary.warnings.push(`Purchase skipped at row ${i+1} in ${txnTable}: party not found`);
// // //             continue;
// // //           }
// // //           const items = lineRows.length ? lineRows.map(line => ({
// // //             product_id: null,
// // //             product_name: firstValue(line, ["item_name", "product_name", "name"], ""),
// // //             product_description: firstValue(line, ["description"], ""),
// // //             quantity: firstNumber(line, ["quantity", "qty"], 0),
// // //             cost_price: firstNumber(line, ["priceperunit", "cost_price", "price"], 0),
// // //             amount: firstNumber(line, ["total_amount", "amount"], 0),
// // //           })) : [];
// // //           const partyNameResolved = (await partiesCollection.findOne({ _id: toObjectId(partyId) }))?.name || partyName || "";

// // //           await purchaseBillsCollection.updateOne(
// // //             { user_id: toObjectId(user.id), external_source: "vyapar", external_id: externalId },
// // //             {
// // //               $set: {
// // //                 party_id: toObjectId(partyId),
// // //                 party_name: partyNameResolved,
// // //                 items,
// // //                 discount: firstNumber(row, ["txn_discount_amount", "discount"], 0),
// // //                 discount_type: firstValue(row, ["discount_type"], "fixed"),
// // //                 tax: firstNumber(row, ["txn_tax_amount", "tax"], 0),
// // //                 tax_type: firstValue(row, ["tax_type"], "fixed"),
// // //                 total_amount: amount,
// // //                 paid_amount: paidAmount,
// // //                 balance_due: amount - paidAmount,
// // //                 is_paid: paidAmount >= amount && amount > 0,
// // //                 payment_method_id: paymentMethodId,
// // //                 payment_method_name: firstValue(row, ["txn_payment_type_id", "payment_method"], ""),
// // //                 description: firstValue(row, ["txn_description", "description"], ""),
// // //                 updated_at: new Date(),
// // //               },
// // //               $setOnInsert: {
// // //                 user_id: toObjectId(user.id),
// // //                 created_at: new Date(),
// // //                 external_source: "vyapar",
// // //                 external_id: externalId,
// // //                 source_table: txnTable,
// // //                 source_row_id: str(row.id ?? row._id ?? row.txn_id ?? i),
// // //               },
// // //             },
// // //             { upsert: true }
// // //           );
// // //           const billDoc = await purchaseBillsCollection.findOne({ user_id: toObjectId(user.id), external_source: "vyapar", external_id: externalId });
// // //           if (billDoc?._id) {
// // //             await appendPartyLedgerEntry({
// // //               userId: user.id,
// // //               partyId,
// // //               eventKey: `vyapar:purchase:${billDoc._id.toString()}`,
// // //               eventType: "purchase_bill_debit",
// // //               eventSource: "party_transaction",
// // //               eventSourceId: billDoc._id.toString(),
// // //               amountDelta: amount,
// // //               effectiveAt: date,
// // //               metadata: { source: "vyapar_import", party_name: partyNameResolved, payment_method_id: paymentMethodId },
// // //             });
// // //           }
// // //           summary.purchaseBillsImported++;
// // //           continue;
// // //         }

// // //         // ---- PAYMENT IN / OUT ----
// // //         if (kind === "payment_in" || kind === "payment_out") {
// // //           if (!partyId) {
// // //             summary.warnings.push(`Payment skipped at row ${i+1} in ${txnTable}: party not found`);
// // //             continue;
// // //           }
// // //           const paymentAmount = paidAmount > 0 ? paidAmount : amount;
// // //           if (paymentAmount <= 0) continue;
// // //           const transactionType = kind === "payment_in" ? "payment-in" : "payment-out";

// // //           await partyTransactionCollection.updateOne(
// // //             { user_id: toObjectId(user.id), external_source: "vyapar", external_id: externalId },
// // //             {
// // //               $set: {
// // //                 customer_id: toObjectId(partyId),
// // //                 payment_amount: paymentAmount,
// // //                 payment_method_id: paymentMethodId || "cash",
// // //                 date,
// // //                 type: transactionType,
// // //                 updated_at: new Date(),
// // //               },
// // //               $setOnInsert: {
// // //                 user_id: toObjectId(user.id),
// // //                 created_at: new Date(),
// // //                 external_source: "vyapar",
// // //                 external_id: externalId,
// // //                 source_table: txnTable,
// // //                 source_row_id: str(row.id ?? row._id ?? row.txn_id ?? i),
// // //               },
// // //             },
// // //             { upsert: true }
// // //           );
// // //           await appendCustomerLedgerEntry({
// // //             userId: user.id,
// // //             customerId: partyId,
// // //             eventKey: `vyapar:${kind}:${externalId}`,
// // //             eventType: kind === "payment_in" ? "payment_in_credit" : "payment_out_debit",
// // //             eventSource: "party_transaction",
// // //             eventSourceId: externalId,
// // //             amountDelta: kind === "payment_in" ? -paymentAmount : paymentAmount,
// // //             effectiveAt: date,
// // //             metadata: { source: "vyapar_import", payment_method_id: paymentMethodId },
// // //           });
// // //           summary.partyTransactionsImported++;
// // //           continue;
// // //         }

// // //         // ---- EXPENSE ----
// // //         if (kind === "expense") {
// // //           const expenseNumber = firstValue(row, ["txn_ref_number_char", "expense_number", "voucher_no"], externalId);
// // //           const category = firstValue(row, ["txn_category_id", "category", "group"], "Misc");
// // //           const itemName = firstValue(row, ["txn_description", "description", "item_name"], "Expense");
// // //           await expensesCollection.updateOne(
// // //             { user_id: toObjectId(user.id), external_source: "vyapar", external_id: externalId },
// // //             {
// // //               $set: {
// // //                 expense_number: expenseNumber,
// // //                 date,
// // //                 category,
// // //                 item_name: itemName,
// // //                 description: itemName,
// // //                 qty: 1,
// // //                 rate: amount,
// // //                 amount,
// // //                 updated_at: new Date(),
// // //               },
// // //               $setOnInsert: {
// // //                 user_id: toObjectId(user.id),
// // //                 created_at: new Date(),
// // //                 external_source: "vyapar",
// // //                 external_id: externalId,
// // //                 source_table: txnTable,
// // //                 source_row_id: str(row.id ?? row._id ?? row.txn_id ?? i),
// // //               },
// // //             },
// // //             { upsert: true }
// // //           );
// // //           summary.expensesImported++;
// // //           continue;
// // //         }

// // //         // Fallback
// // //         if (amount > 0 && (partyId || partyName)) {
// // //           summary.warnings.push(`Row ${i+1} in ${txnTable} treated as expense fallback`);
// // //           await expensesCollection.updateOne(
// // //             { user_id: toObjectId(user.id), external_source: "vyapar", external_id: externalId },
// // //             {
// // //               $set: {
// // //                 expense_number: invoiceNo || externalId,
// // //                 date,
// // //                 category: "Unclassified",
// // //                 item_name: partyName || "Unknown",
// // //                 description: row.txn_description || "",
// // //                 qty: 1,
// // //                 rate: amount,
// // //                 amount,
// // //                 updated_at: new Date(),
// // //               },
// // //               $setOnInsert: {
// // //                 user_id: toObjectId(user.id),
// // //                 created_at: new Date(),
// // //                 external_source: "vyapar",
// // //                 external_id: externalId,
// // //                 source_table: txnTable,
// // //                 source_row_id: str(row.id ?? row._id ?? i),
// // //               },
// // //             },
// // //             { upsert: true }
// // //           );
// // //           summary.expensesImported++;
// // //         } else {
// // //           summary.warnings.push(`Row ${i+1} in ${txnTable} could not be classified`);
// // //         }
// // //       }
// // //     }

// // //     // 5) Direct expense table
// // //     if (detected.expenseTable && !detected.transactionTables.includes(detected.expenseTable)) {
// // //       const expenseRows = await readAll(db, detected.expenseTable);
// // //       console.log(`💸 Importing ${expenseRows.length} expenses from dedicated table ${detected.expenseTable}...`);
// // //       const inserted = await importExpensesFromRows(user.id, expenseRows);
// // //       summary.expensesImported += inserted;
// // //     }

// // //     console.log("\n🎉 IMPORT COMPLETED!");
// // //     console.log("Summary:", summary);

// // //     return NextResponse.json({
// // //       success: true,
// // //       message: "Vyapar backup imported successfully",
// // //       summary,
// // //     });
// // //   } catch (error) {
// // //     console.error("❌ Vyapar import error:", error);
// // //     return NextResponse.json(
// // //       { error: error instanceof Error ? error.message : "Import failed" },
// // //       { status: 500 }
// // //     );
// // //   } finally {
// // //     // Close database if open
// // //     if (db) {
// // //       try {
// // //         await db.close();
// // //         console.log("🗄️ Database connection closed.");
// // //       } catch (e) {
// // //         console.warn("Error closing db:", e);
// // //       }
// // //     }
// // //     // Cleanup temp directory
// // //     if (tempDir && fs.existsSync(tempDir)) {
// // //       try {
// // //         await new Promise(resolve => setTimeout(resolve, 500));
// // //         fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
// // //         console.log("🧹 Temp directory cleaned up successfully.");
// // //       } catch (e) {
// // //         console.warn("Failed to delete temp dir:", e);
// // //         try {
// // //           const { execSync } = require("child_process");
// // //           execSync(`rmdir /s /q "${tempDir}"`, { stdio: "ignore" });
// // //           console.log("🧹 Temp directory cleaned using rmdir.");
// // //         } catch (e2) {
// // //           console.warn("Could not delete temp directory, will be cleaned on reboot:", tempDir);
// // //         }
// // //       }
// // //     }
// // //   }
// // // }

// // // // Helper ensurePartyByName (kept as before)
// // // async function ensurePartyByName(
// // //   partiesCollection: Awaited<ReturnType<typeof getCollection>>,
// // //   userId: string,
// // //   name: string,
// // //   extra: Partial<Record<string, any>> = {},
// // // ) {
// // //   const userObjId = toObjectId(userId);
// // //   const cleanName = str(name);
// // //   if (!cleanName) return null;

// // //   const existing = await partiesCollection.findOne({
// // //     user_id: userObjId,
// // //     name: cleanName,
// // //     is_delete: { $ne: 1 },
// // //   });
// // //   if (existing?._id) return existing;

// // //   const now = new Date();
// // //   const result = await partiesCollection.insertOne({
// // //     user_id: userObjId,
// // //     name: cleanName,
// // //     email: extra.email ?? "",
// // //     phone: extra.phone ?? "",
// // //     company_name: extra.company_name ?? "",
// // //     company_address: extra.company_address ?? "",
// // //     opening_balance: num(extra.opening_balance, 0),
// // //     status: extra.status ?? "active",
// // //     is_delete: 0,
// // //     created_at: now,
// // //     updated_at: now,
// // //     external_source: "vyapar",
// // //     external_id: extra.external_id ?? null,
// // //     source_table: extra.source_table ?? null,
// // //     source_row_id: extra.source_row_id ?? null,
// // //   });

// // //   const inserted = await partiesCollection.findOne({ _id: result.insertedId });
// // //   const openingBalance = num(extra.opening_balance, 0);
// // //   if (inserted?._id && openingBalance !== 0) {
// // //     await seedCustomerOpeningBalance(userId, inserted._id.toString(), openingBalance, now);
// // //   }
// // //   return inserted;
// // // }












// import { NextRequest, NextResponse } from "next/server";
// import fs from "fs";
// import path from "path";
// import os from "os";
// import AdmZip from "adm-zip";
// import sqlite3 from "sqlite3";
// import { open } from "sqlite";

// import { getCurrentUser } from "@/lib/auth/utils";
// import { getCollection, COLLECTIONS, toObjectId } from "@/lib/db/mongodb";

// // ================= HELPERS =================

// const str = (v: any) => (v ? String(v).trim() : "");
// const num = (v: any) => Number(v) || 0;

// function first(row: any, keys: string[]) {
//   for (const k of keys) {
//     if (row[k] !== undefined && row[k] !== null && row[k] !== "") {
//       return row[k];
//     }
//   }
//   return "";
// }

// // ================= MAIN =================

// export async function POST(req: NextRequest) {
//   const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vyapar-"));
//   let db: any = null;

//   try {
//     const user = await getCurrentUser() as { id: string } | null;
//     if (!user) throw new Error("Unauthorized");

//     console.log("👤 USER:", user.id);

//     const formData = await req.formData();
//     const file = formData.get("file") as File;

//     if (!file) throw new Error("File missing");

//     console.log("📂 FILE:", file.name);

//     const buffer = Buffer.from(await file.arrayBuffer());
//     const filePath = path.join(tempDir, file.name);
//     fs.writeFileSync(filePath, buffer);

//     // unzip
//     let dbPath = filePath;
//     if (file.name.endsWith(".vyb")) {
//       const zip = new AdmZip(filePath);
//       const entry = zip.getEntries().find(e => e.entryName.endsWith(".vyp"));
//       if (!entry) throw new Error("Invalid backup");
//       dbPath = path.join(tempDir, "data.vyp");
//       fs.writeFileSync(dbPath, entry.getData());
//     }

//     console.log("📦 Extracted DB:", dbPath);

//     db = await open({ filename: dbPath, driver: sqlite3.Database });

//     // ================= COLLECTIONS =================
//     const partiesCol = await getCollection(COLLECTIONS.PARTIES);
//     const productsCol = await getCollection(COLLECTIONS.PRODUCTS);
//     const paymentsCol = await getCollection(COLLECTIONS.PAYMENT_METHOD);
//     const ordersCol = await getCollection(COLLECTIONS.ORDERS);
//     const purchaseCol = await getCollection(COLLECTIONS.PURCHASE_BILLS);
//     const txnCol = await getCollection(COLLECTIONS.CUSTOMER_TRANSACTIONS);
//     const expenseCol = await getCollection(COLLECTIONS.EXPENSES);

//     const summary = {
//       parties: 0,
//       products: 0,
//       payments: 0,
//       sales: 0,
//       purchases: 0,
//       transactions: 0,
//       expenses: 0,
//       skipped: 0,
//     };

//     // ================= PARTIES =================
//     const parties = await db.all(`SELECT * FROM kb_names`);
//     console.log("👥 TOTAL PARTIES:", parties.length);

//     for (const p of parties) {
//       const name = str(first(p, ["full_name", "name"]));
//       const nameId = str(p.name_id);

//       if (!name) continue;

//       await partiesCol.updateOne(
//         { user_id: toObjectId(user.id), source_name_id: nameId },
//         {
//           $set: {
//             name,
//             phone: str(p.phone_number),
//             source_name_id: nameId,
//             source: "vyapar",
//             updated_at: new Date(),
//           },
//         },
//         { upsert: true }
//       );

//       console.log("✅ PARTY:", name, "| ID:", nameId);
//       summary.parties++;
//     }

//     const partyList = await partiesCol.find({ user_id: toObjectId(user.id) }).toArray();

//     // ================= PRODUCTS =================
//     const products = await db.all(`SELECT * FROM kb_items`);
//     console.log("📦 TOTAL PRODUCTS:", products.length);

//     for (const pr of products) {
//       const name = str(pr.item_name);
//       if (!name) continue;

//       const sale = num(first(pr, ["item_sale_unit_price", "sale_price"]));
//       const purchase = num(first(pr, ["item_purchase_unit_price", "purchase_price"]));

//       await productsCol.updateOne(
//         { user_id: toObjectId(user.id), name },
//         {
//           $set: {
//             name,
//             sale_price: sale,
//             purchase_price: purchase,
//             stock: num(pr.item_stock_quantity),
//             updated_at: new Date(),
//           },
//         },
//         { upsert: true }
//       );

//       console.log("✅ PRODUCT:", name, "| Sale:", sale);
//       summary.products++;
//     }

//     // ================= PAYMENT METHODS =================
//     const payments = await db.all(`SELECT * FROM kb_paymentTypes`);
//     console.log("💳 TOTAL PAYMENTS:", payments.length);

//     for (const pm of payments) {
//       const name = str(pm.paymenttype_name);
//       if (!name) continue;

//       await paymentsCol.updateOne(
//         { user_id: toObjectId(user.id), bank_name: name },
//         {
//           $set: {
//             bank_name: name,
//             type: str(pm.paymenttype_type),
//             source: "vyapar",
//           },
//         },
//         { upsert: true }
//       );

//       console.log("✅ PAYMENT:", name);
//       summary.payments++;
//     }

//     // ================= LINE ITEMS =================
//     const lines = await db.all(`SELECT * FROM kb_lineitems`);
//     console.log("🧾 TOTAL LINE ITEMS:", lines.length);

//     // ================= TXNS =================
//     const txns = await db.all(`SELECT * FROM kb_transactions`);
//     console.log("📄 TOTAL TXNS:", txns.length);

//     for (const t of txns) {
//       const txnId = t.txn_id;
//       const type = str(t.txn_type).toLowerCase();
//       const partyRef = str(t.txn_name_id);

//       const party = partyList.find(p => p.source_name_id === partyRef);

//       const items = lines.filter(l => String(l.lineitem_txn_id) === String(txnId));

//       const amount = num(t.txn_balance_amount) || num(t.txn_cash_amount);

//       console.log("🔍 TXN:", {
//         id: txnId,
//         type,
//         partyRef,
//         partyFound: !!party,
//         items: items.length,
//         amount,
//       });

//       if (!party) {
//         console.log("❌ SKIPPED (NO PARTY)");
//         summary.skipped++;
//         continue;
//       }

//       // ===== SALE =====
//       if (type.includes("sale")) {
//         await ordersCol.insertOne({
//           user_id: toObjectId(user.id),
//           customer_id: party._id,
//           total_amount: amount,
//           items: items.map(i => ({
//             name: i.item_name,
//             quantity: num(i.quantity),
//             price: num(i.priceperunit),
//           })),
//           created_at: new Date(),
//         });
//         summary.sales++;
//         continue;
//       }

//       // ===== PURCHASE =====
//       if (type.includes("purchase")) {
//         await purchaseCol.insertOne({
//           user_id: toObjectId(user.id),
//           party_id: party._id,
//           total_amount: amount,
//           items: items.map(i => ({
//             product_name: i.item_name,
//             quantity: num(i.quantity),
//             cost_price: num(i.priceperunit),
//           })),
//           created_at: new Date(),
//         });
//         summary.purchases++;
//         continue;
//       }

//       // ===== PAYMENT =====
//       if (type.includes("payment")) {
//         await txnCol.insertOne({
//           user_id: toObjectId(user.id),
//           customer_id: party._id,
//           payment_amount: amount,
//           type: type.includes("in") ? "payment-in" : "payment-out",
//           created_at: new Date(),
//         });
//         summary.transactions++;
//         continue;
//       }

//       // ===== EXPENSE =====
//       await expenseCol.insertOne({
//         user_id: toObjectId(user.id),
//         amount,
//         item_name: party.name,
//         created_at: new Date(),
//       });

//       summary.expenses++;
//     }

//     console.log("🎉 FINAL SUMMARY:", summary);

//     return NextResponse.json({ success: true, summary });

//   } catch (err: any) {
//     console.error("❌ ERROR:", err);
//     return NextResponse.json({ error: err.message }, { status: 500 });
//   } finally {
//     if (db) await db.close();
//     fs.rmSync(tempDir, { recursive: true, force: true });
//   }
// }

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import AdmZip from "adm-zip";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

import { getCurrentUser } from "@/lib/auth/utils";
import { getCollection, COLLECTIONS, toObjectId } from "@/lib/db/mongodb";

// ================= HELPERS =================

const str = (v: any) => (v ? String(v).trim() : "");
const num = (v: any) => Number(v) || 0;

function first(row: any, keys: string[]) {
  for (const k of keys) {
    if (row?.[k] !== undefined && row?.[k] !== null && row?.[k] !== "") {
      return row[k];
    }
  }
  return "";
}

// ================= TXN TYPE MAPPER =================

function mapTxnType(
  code: number
): "sale" | "purchase" | "payment_in" | "payment_out" | "expense" | "purchase_return" | "sale_return" | "journal" | "unknown" {
  switch (code) {
    case 1:
      return "sale";
    case 2:
      return "payment_in";
    case 3:
      return "payment_out";
    case 4:
      return "expense";
    case 5:
      return "purchase_return";
    case 6:
      return "sale_return";
    case 7:
      return "journal";
    case 8:
      return "purchase";
    default:
      return "unknown";
  }
}

// ================= MAIN =================

export async function POST(req: NextRequest) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vyapar-"));
  let db: any = null;

  try {
    const user = (await getCurrentUser()) as { id: string } | null;
    if (!user) throw new Error("Unauthorized");

    console.log("👤 USER:", user.id);

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) throw new Error("File missing");

    console.log("📂 FILE:", file.name);

    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = path.join(tempDir, file.name);
    fs.writeFileSync(filePath, buffer);

    // ================= EXTRACT =================
    let dbPath = filePath;

    if (file.name.endsWith(".vyb")) {
      const zip = new AdmZip(filePath);
      const entry = zip.getEntries().find((e) => e.entryName.endsWith(".vyp"));

      if (!entry) throw new Error("Invalid Vyapar backup file");

      dbPath = path.join(tempDir, "data.vyp");
      fs.writeFileSync(dbPath, entry.getData());
    }

    console.log("📦 Extracted DB:", dbPath);

    db = await open({ filename: dbPath, driver: sqlite3.Database });

    // ================= COLLECTIONS =================
    const partiesCol = await getCollection(COLLECTIONS.PARTIES);
    const productsCol = await getCollection(COLLECTIONS.PRODUCTS);
    const paymentsCol = await getCollection(COLLECTIONS.PAYMENT_METHOD);
    const ordersCol = await getCollection(COLLECTIONS.ORDERS);
    const purchaseCol = await getCollection(COLLECTIONS.PURCHASE_BILLS);
    const txnCol = await getCollection(COLLECTIONS.CUSTOMER_TRANSACTIONS);
    const expenseCol = await getCollection(COLLECTIONS.EXPENSES);

    // ================= SUMMARY =================
    const summary = {
      parties: 0,
      products: 0,
      payments: 0,
      sales: 0,
      purchases: 0,
      transactions: 0,
      expenses: 0,
      skipped: 0,
    };

    // ================= PARTIES =================
    const parties = await db.all(`SELECT * FROM kb_names`);
    console.log("👥 TOTAL PARTIES:", parties.length);

    for (const p of parties) {
      const name = str(first(p, ["full_name", "name"]));
      const nameId = str(p.name_id);

      if (!name) continue;

      await partiesCol.updateOne(
        { user_id: toObjectId(user.id), source_name_id: nameId },
        {
          $set: {
            name,
            phone: str(p.phone_number),
            source_name_id: nameId,
            source: "vyapar",
            updated_at: new Date(),
          },
        },
        { upsert: true }
      );

      console.log("✅ PARTY:", name, "| ID:", nameId);
      summary.parties++;
    }

    const partyList = await partiesCol
      .find({ user_id: toObjectId(user.id) })
      .toArray();

    // ================= PRODUCTS =================
    const products = await db.all(`SELECT * FROM kb_items`);
    console.log("📦 TOTAL PRODUCTS:", products.length);

    for (const pr of products) {
      const name = str(pr.item_name);
      if (!name) continue;

      await productsCol.updateOne(
        { user_id: toObjectId(user.id), name },
        {
          $set: {
            name,
            sale_price: num(first(pr, ["item_sale_unit_price"])),
            purchase_price: num(first(pr, ["item_purchase_unit_price"])),
            stock: num(pr.item_stock_quantity),
            updated_at: new Date(),
          },
        },
        { upsert: true }
      );

      console.log("✅ PRODUCT:", name);
      summary.products++;
    }

    // ================= PAYMENT METHODS =================
    const payments = await db.all(`SELECT * FROM kb_paymentTypes`);
    console.log("💳 TOTAL PAYMENT METHODS:", payments.length);

    for (const pm of payments) {
      const name = str(pm.paymenttype_name);
      if (!name) continue;

      await paymentsCol.updateOne(
        { user_id: toObjectId(user.id), bank_name: name },
        {
          $set: {
            bank_name: name,
            type: str(pm.paymenttype_type),
            source: "vyapar",
          },
        },
        { upsert: true }
      );

      console.log("✅ PAYMENT METHOD:", name);
      summary.payments++;
    }

    // ================= LINE ITEMS =================
    const lines = await db.all(`SELECT * FROM kb_lineitems`);
    console.log("🧾 TOTAL LINE ITEMS:", lines.length);

    // ================= TRANSACTIONS =================
    const txns = await db.all(`SELECT * FROM kb_transactions`);
    console.log("📄 TOTAL TXNS:", txns.length);

    for (const t of txns) {
      const rawType = Number(t.txn_type);
      const type = mapTxnType(rawType);

      const txnId = t.txn_id;
      const partyRef = str(t.txn_name_id);

      const party = partyList.find((p) => p.source_name_id === partyRef);
      const items = lines.filter(
        (l: { lineitem_txn_id: any; }) => String(l.lineitem_txn_id) === String(txnId)
      );

      const amount = num(t.txn_balance_amount) || num(t.txn_cash_amount);

      console.log("🔍 TXN DEBUG:", {
        id: txnId,
        rawType,
        mappedType: type,
        partyRef,
        partyFound: !!party,
        items: items.length,
        amount,
      });

      if (!party) {
        summary.skipped++;
        continue;
      }

      // ================= SALE =================
      if (type === "sale") {
        await ordersCol.insertOne({
          user_id: toObjectId(user.id),
          customer_id: party._id,
          total_amount: amount,
          items: items.map((i: { item_name: any; quantity: any; priceperunit: any; }) => ({
            name: i.item_name,
            quantity: num(i.quantity),
            price: num(i.priceperunit),
          })),
          created_at: new Date(),
        });

        summary.sales++;
        continue;
      }

      // ================= PURCHASE (fallback logic) =================
      if (  type === "purchase" || type === "purchase_return") {
        await purchaseCol.insertOne({
          user_id: toObjectId(user.id),
          party_id: party._id,
          total_amount: amount,
          items: items.map((i: { item_name: any; quantity: any; priceperunit: any; }) => ({
            product_name: i.item_name,
            quantity: num(i.quantity),
            cost_price: num(i.priceperunit),
          })),
          created_at: new Date(),
        });

        summary.purchases++;
        continue;
      }

      // ================= PAYMENT =================
      if (type === "payment_in" || type === "payment_out") {
        await txnCol.insertOne({
          user_id: toObjectId(user.id),
          customer_id: party._id,
          payment_amount: amount,
          type,
          created_at: new Date(),
        });

        summary.transactions++;
        continue;
      }

      // ================= EXPENSE =================
      if (type === "expense") {
        await expenseCol.insertOne({
          user_id: toObjectId(user.id),
          amount,
          item_name: party.name,
          created_at: new Date(),
        });

        summary.expenses++;
        continue;
      }

      console.log("⚠️ UNKNOWN TXN SKIPPED:", txnId);
      summary.skipped++;
    }

    console.log("🎉 FINAL SUMMARY:", summary);

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (err: any) {
    console.error("❌ IMPORT ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  } finally {
    if (db) await db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}