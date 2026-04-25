
// // import { NextRequest, NextResponse } from "next/server";
// // import fs from "fs";
// // import path from "path";
// // import os from "os";
// // import AdmZip from "adm-zip";
// // import sqlite3 from "sqlite3";
// // import { open } from "sqlite";

// // import { getCurrentUser } from "@/lib/auth/utils";
// // import { getCollection, COLLECTIONS, toObjectId } from "@/lib/db/mongodb";

// // // ================= HELPERS =================

// // const str = (v: any) => (v ? String(v).trim() : "");
// // const num = (v: any) => Number(v) || 0;

// // function first(row: any, keys: string[]) {
// //   for (const k of keys) {
// //     if (row?.[k] !== undefined && row?.[k] !== null && row?.[k] !== "") {
// //       return row[k];
// //     }
// //   }
// //   return "";
// // }

// // // ================= TXN TYPE MAPPER =================

// // function mapTxnType(code: number) {
// //   switch (code) {
// //     case 1:
// //       return "sale";
// //     case 2:
// //       return "payment_in";
// //     case 3:
// //       return "payment_out";
// //     case 4:
// //       return "expense";
// //     case 5:
// //       return "purchase_return";
// //     case 6:
// //       return "sale_return";
// //     case 7:
// //       return "journal";
// //     default:
// //       return "unknown";
// //   }
// // }

// // // ================= MAIN =================

// // export async function POST(req: NextRequest) {
// //   const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vyapar-"));
// //   let db: any = null;

// //   try {
// //     const user = (await getCurrentUser()) as { id: string } | null;
// //     if (!user) throw new Error("Unauthorized");

// //     console.log("👤 USER:", user.id);

// //     const formData = await req.formData();
// //     const file = formData.get("file") as File;

// //     if (!file) throw new Error("File missing");

// //     console.log("📂 FILE:", file.name);

// //     const buffer = Buffer.from(await file.arrayBuffer());
// //     const filePath = path.join(tempDir, file.name);
// //     fs.writeFileSync(filePath, buffer);

// //     // ================= EXTRACT =================
// //     let dbPath = filePath;

// //     if (file.name.endsWith(".vyb")) {
// //       const zip = new AdmZip(filePath);
// //       const entry = zip.getEntries().find((e) => e.entryName.endsWith(".vyp"));

// //       if (!entry) throw new Error("Invalid Vyapar backup file");

// //       dbPath = path.join(tempDir, "data.vyp");
// //       fs.writeFileSync(dbPath, entry.getData());
// //     }

// //     console.log("📦 Extracted DB:", dbPath);

// //     db = await open({ filename: dbPath, driver: sqlite3.Database });

// //     // ================= COLLECTIONS =================
// //     const partiesCol = await getCollection(COLLECTIONS.PARTIES);
// //     const productsCol = await getCollection(COLLECTIONS.PRODUCTS);
// //     const paymentsCol = await getCollection(COLLECTIONS.PAYMENT_METHOD);
// //     const ordersCol = await getCollection(COLLECTIONS.ORDERS);
// //     const purchaseCol = await getCollection(COLLECTIONS.PURCHASE_BILLS);
// //     const txnCol = await getCollection(COLLECTIONS.CUSTOMER_TRANSACTIONS);
// //     const expenseCol = await getCollection(COLLECTIONS.EXPENSES);

// //     // ================= SUMMARY =================
// //     const summary = {
// //       parties: 0,
// //       products: 0,
// //       payments: 0,
// //       sales: 0,
// //       purchases: 0,
// //       transactions: 0,
// //       expenses: 0,
// //       skipped: 0,
// //     };

// //     // ================= PARTIES =================
// //     const parties = await db.all(`SELECT * FROM kb_names`);
// //     console.log("👥 TOTAL PARTIES:", parties.length);

// //     for (const p of parties) {
// //       const name = str(first(p, ["full_name", "name"]));
// //       const nameId = str(p.name_id);

// //       if (!name) continue;

// //       await partiesCol.updateOne(
// //         { user_id: toObjectId(user.id), source_name_id: nameId },
// //         {
// //           $set: {
// //             name,
// //             phone: str(p.phone_number),
// //             source_name_id: nameId,
// //             source: "vyapar",
// //             updated_at: new Date(),
// //           },
// //         },
// //         { upsert: true }
// //       );

// //       console.log("✅ PARTY:", name, "| ID:", nameId);
// //       summary.parties++;
// //     }

// //     const partyList = await partiesCol
// //       .find({ user_id: toObjectId(user.id) })
// //       .toArray();

// //     // ================= PRODUCTS =================
// //     const products = await db.all(`SELECT * FROM kb_items`);
// //     console.log("📦 TOTAL PRODUCTS:", products.length);

// //     for (const pr of products) {
// //       const name = str(pr.item_name);
// //       if (!name) continue;

// //       await productsCol.updateOne(
// //         { user_id: toObjectId(user.id), name },
// //         {
// //           $set: {
// //             name,
// //             sale_price: num(first(pr, ["item_sale_unit_price"])),
// //             purchase_price: num(first(pr, ["item_purchase_unit_price"])),
// //             stock: num(pr.item_stock_quantity),
// //             updated_at: new Date(),
// //           },
// //         },
// //         { upsert: true }
// //       );

// //       console.log("✅ PRODUCT:", name);
// //       summary.products++;
// //     }

// //     // ================= PAYMENT METHODS =================
// //     const payments = await db.all(`SELECT * FROM kb_paymentTypes`);
// //     console.log("💳 TOTAL PAYMENT METHODS:", payments.length);

// //     for (const pm of payments) {
// //       const name = str(pm.paymenttype_name);
// //       if (!name) continue;

// //       await paymentsCol.updateOne(
// //         { user_id: toObjectId(user.id), bank_name: name },
// //         {
// //           $set: {
// //             bank_name: name,
// //             type: str(pm.paymenttype_type),
// //             source: "vyapar",
// //           },
// //         },
// //         { upsert: true }
// //       );

// //       console.log("✅ PAYMENT METHOD:", name);
// //       summary.payments++;
// //     }

// //     // ================= LINE ITEMS =================
// //     const lines = await db.all(`SELECT * FROM kb_lineitems`);
// //     console.log("🧾 TOTAL LINE ITEMS:", lines.length);

// //     // ================= TRANSACTIONS =================
// //     const txns = await db.all(`SELECT * FROM kb_transactions`);
// //     console.log("📄 TOTAL TXNS:", txns.length);

// //     for (const t of txns) {
// //       const rawType = Number(t.txn_type);
// //       const type = mapTxnType(rawType);

// //       const txnId = t.txn_id;
// //       const partyRef = str(t.txn_name_id);

// //       const party = partyList.find((p) => p.source_name_id === partyRef);
// //       const items = lines.filter(
// //         (l) => String(l.lineitem_txn_id) === String(txnId)
// //       );

// //       const amount = num(t.txn_balance_amount) || num(t.txn_cash_amount);

// //       console.log("🔍 TXN DEBUG:", {
// //         id: txnId,
// //         rawType,
// //         mappedType: type,
// //         partyRef,
// //         partyFound: !!party,
// //         items: items.length,
// //         amount,
// //       });

// //       if (!party) {
// //         summary.skipped++;
// //         continue;
// //       }

// //       // ================= SALE =================
// //       if (type === "sale") {
// //         await ordersCol.insertOne({
// //           user_id: toObjectId(user.id),
// //           customer_id: party._id,
// //           total_amount: amount,
// //           items: items.map((i) => ({
// //             name: i.item_name,
// //             quantity: num(i.quantity),
// //             price: num(i.priceperunit),
// //           })),
// //           created_at: new Date(),
// //         });

// //         summary.sales++;
// //         continue;
// //       }

// //       // ================= PURCHASE (fallback logic) =================
// //       if (type === "purchase" || type === "purchase_return") {
// //         await purchaseCol.insertOne({
// //           user_id: toObjectId(user.id),
// //           party_id: party._id,
// //           total_amount: amount,
// //           items: items.map((i) => ({
// //             product_name: i.item_name,
// //             quantity: num(i.quantity),
// //             cost_price: num(i.priceperunit),
// //           })),
// //           created_at: new Date(),
// //         });

// //         summary.purchases++;
// //         continue;
// //       }

// //       // ================= PAYMENT =================
// //       if (type === "payment_in" || type === "payment_out") {
// //         await txnCol.insertOne({
// //           user_id: toObjectId(user.id),
// //           customer_id: party._id,
// //           payment_amount: amount,
// //           type,
// //           created_at: new Date(),
// //         });

// //         summary.transactions++;
// //         continue;
// //       }

// //       // ================= EXPENSE =================
// //       if (type === "expense") {
// //         await expenseCol.insertOne({
// //           user_id: toObjectId(user.id),
// //           amount,
// //           item_name: party.name,
// //           created_at: new Date(),
// //         });

// //         summary.expenses++;
// //         continue;
// //       }

// //       console.log("⚠️ UNKNOWN TXN SKIPPED:", txnId);
// //       summary.skipped++;
// //     }

// //     console.log("🎉 FINAL SUMMARY:", summary);

// //     return NextResponse.json({
// //       success: true,
// //       summary,
// //     });
// //   } catch (err: any) {
// //     console.error("❌ IMPORT ERROR:", err);
// //     return NextResponse.json(
// //       { success: false, error: err.message },
// //       { status: 500 }
// //     );
// //   } finally {
// //     if (db) await db.close();
// //     fs.rmSync(tempDir, { recursive: true, force: true });
// //   }
// // }







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
//     if (row?.[k] !== undefined && row?.[k] !== null && row?.[k] !== "") {
//       return row[k];
//     }
//   }
//   return "";
// }

// // ================= TYPE MAP =================

// function mapTxnType(code: number) {
//   switch (code) {
//     case 1: return "sale";
//     case 2: return "payment_in";
//     case 3: return "payment_out";
//     case 4: return "expense";
//     case 7: return "journal";
//     default: return "unknown";
//   }
// }

// // ================= MAIN =================

// export async function POST(req: NextRequest) {
//   const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vyapar-"));
//   let db: any = null;

//   try {
//     const user = await getCurrentUser() as { id: string } | null;
//     if (!user) throw new Error("Unauthorized");

//     const formData = await req.formData();
//     const file = formData.get("file") as File;
//     if (!file) throw new Error("File missing");

//     console.log("👤 USER:", user.id);
//     console.log("📂 FILE:", file.name);

//     const buffer = Buffer.from(await file.arrayBuffer());
//     const filePath = path.join(tempDir, file.name);
//     fs.writeFileSync(filePath, buffer);

//     // ===== unzip =====
//     let dbPath = filePath;
//     if (file.name.endsWith(".vyb")) {
//       const zip = new AdmZip(filePath);
//       const entry = zip.getEntries().find(e => e.entryName.endsWith(".vyp"));
//       if (!entry) throw new Error("Invalid backup");
//       dbPath = path.join(tempDir, "data.vyp");
//       fs.writeFileSync(dbPath, entry.getData());
//     }

//     console.log("📦 DB:", dbPath);

//     db = await open({ filename: dbPath, driver: sqlite3.Database });

//     // ===== collections =====
//     const partiesCol = await getCollection(COLLECTIONS.PARTIES);
//     const productsCol = await getCollection(COLLECTIONS.PRODUCTS);
//     const txnCol = await getCollection(COLLECTIONS.CUSTOMER_TRANSACTIONS);
//     const ordersCol = await getCollection(COLLECTIONS.ORDERS);
//     const expenseCol = await getCollection(COLLECTIONS.EXPENSES);

//     const summary = {
//       parties: 0,
//       products: 0,
//       payments_in: 0,
//       payments_out: 0,
//       sales: 0,
//       expenses: 0,
//       skipped: 0,
//     };

//     // ===== PARTIES =====
//     const parties = await db.all(`SELECT * FROM kb_names`);
//     for (const p of parties) {
//       const name = str(first(p, ["full_name", "name"]));
//       const id = str(p.name_id);
//       if (!name) continue;

//       await partiesCol.updateOne(
//         { user_id: toObjectId(user.id), source_name_id: id },
//         {
//           $set: {
//             name,
//             source_name_id: id,
//             source: "vyapar",
//             updated_at: new Date(),
//           },
//         },
//         { upsert: true }
//       );

//       summary.parties++;
//     }

//     const partyList = await partiesCol.find({ user_id: toObjectId(user.id) }).toArray();

//     // ===== PRODUCTS =====
//     const products = await db.all(`SELECT * FROM kb_items`);
//     for (const pr of products) {
//       const name = str(pr.item_name);
//       if (!name) continue;

//       await productsCol.updateOne(
//         { user_id: toObjectId(user.id), name },
//         {
//           $set: {
//             name,
//             sale_price: num(pr.item_sale_unit_price),
//             purchase_price: num(pr.item_purchase_unit_price),
//             updated_at: new Date(),
//           },
//         },
//         { upsert: true }
//       );

//       summary.products++;
//     }

//     // ===== LINE ITEMS =====
//     const lines = await db.all(`SELECT * FROM kb_lineitems`);

//     // ===== TXNS =====
//     const txns = await db.all(`SELECT * FROM kb_transactions`);

//     for (const t of txns) {
//       const txnId = t.txn_id;
//       const type = mapTxnType(Number(t.txn_type));
//       const partyRef = str(t.txn_name_id);

//       const party = partyList.find(p => p.source_name_id === partyRef);
//       const items = lines.filter(l => String(l.lineitem_txn_id) === String(txnId));

//       const amount = num(t.txn_balance_amount) || num(t.txn_cash_amount);

//       const txnDate =
//         t.txn_date ||
//         t.created_at ||
//         new Date();

//       console.log("🔍 TXN:", {
//         txnId,
//         type,
//         partyRef,
//         partyFound: !!party,
//         items: items.length,
//         amount,
//       });

//       if (!party) {
//         summary.skipped++;
//         continue;
//       }

//       // ===== SALE =====
//       if (type === "sale") {
//         await ordersCol.insertOne({
//           user_id: toObjectId(user.id),
//           customer_id: party._id,
//           total_amount: amount,
//           items: items.map(i => ({
//             name: i.item_name,
//             qty: num(i.quantity),
//             price: num(i.priceperunit),
//           })),
//           created_at: new Date(),
//         });

//         summary.sales++;
//         continue;
//       }

//       // ===== PAYMENT-IN =====
//       if (type === "payment_in") {
//         await txnCol.insertOne({
//           user_id: toObjectId(user.id),
//           customer_id: party._id,
//           payment_amount: amount,

//           type: "payment-in", // ✅ FIXED FORMAT

//           payment_method_id: str(t.payment_type) || "cash",

//           date: new Date(txnDate),

//           created_at: new Date(),
//           updated_at: new Date(),
//         });

//         summary.payments_in++;
//         continue;
//       }

//       // ===== PAYMENT-OUT =====
//       if (type === "payment_out") {
//         await txnCol.insertOne({
//           user_id: toObjectId(user.id),
//           customer_id: party._id,
//           payment_amount: amount,

//           type: "payment-out", // ✅ FIXED FORMAT

//           payment_method_id: str(t.payment_type) || "cash",

//           date: new Date(txnDate),

//           created_at: new Date(),
//           updated_at: new Date(),
//         });

//         summary.payments_out++;
//         continue;
//       }

//       // ===== EXPENSE =====
//       if (type === "expense") {
//         await expenseCol.insertOne({
//           user_id: toObjectId(user.id),
//           amount,
//           item_name: party.name,
//           date: new Date(txnDate),
//           created_at: new Date(),
//           updated_at: new Date(),
//         });

//         summary.expenses++;
//         continue;
//       }

//       summary.skipped++;
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
import { ObjectId } from "mongodb";

import { getCurrentUser } from "@/lib/auth/utils";
import { getCollection, COLLECTIONS, toObjectId } from "@/lib/db/mongodb";

// ------------------- helpers -------------------
const str = (v: any) => (v == null ? "" : String(v).trim());
const num = (v: any) => {
  const n = Number(v);
  return isFinite(n) ? n : 0;
};

function first(row: any, keys: string[]) {
  for (const k of keys) {
    const val = row?.[k];
    if (val !== undefined && val !== null && val !== "") return val;
  }
  return "";
}

function normalize(str: string) {
  return str.toLowerCase().replace(/\s+/g, " ").trim();
}

function isLedgerName(name: string) {
  const n = normalize(name);
  const keywords = [
    "petrol", "transport", "salary", "rent", "tea", "expense",
    "cash sale", "labour", "maintenance", "utility", "electricity",
    "water", "internet", "bill", "commission"
  ];
  return keywords.some(kw => n.includes(kw));
}

function getPaymentMethodId(row: any) {
  const raw = first(row, [
    "payment_method_id", "paymenttype_name", "payment_type",
    "txn_payment_type", "payment_mode", "mode"
  ]);
  const n = normalize(raw);
  if (n.includes("cash")) return "cash";
  if (n.includes("cheque")) return "cheque";
  if (n.includes("bank")) return "bank";
  if (n.includes("upi")) return "upi";
  if (n.includes("card")) return "card";
  return raw || "cash";
}

function getTxnDate(row: any) {
  const raw = first(row, ["txn_date", "date", "created_at", "txn_datetime"]);
  if (!raw) return new Date();
  const d = new Date(raw);
  return isNaN(d.getTime()) ? new Date() : d;
}

function generateExpenseNumber(txnId: string | number, date: Date) {
  return `EXP-${date.getTime()}-${txnId}`;
}

// ------------------- main -------------------
export async function POST(req: NextRequest) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vyapar-"));
  let db: any = null;

  try {
    const user = await getCurrentUser() as { id: string };
    if (!user) throw new Error("Unauthorized");

    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) throw new Error("No file uploaded");

    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = path.join(tempDir, file.name);
    fs.writeFileSync(filePath, buffer);

    let dbPath = filePath;
    if (file.name.endsWith(".vyb")) {
      const zip = new AdmZip(filePath);
      const entry = zip.getEntries().find(e => e.entryName.endsWith(".vyp"));
      if (!entry) throw new Error("Invalid .vyb backup");
      dbPath = path.join(tempDir, "data.vyp");
      fs.writeFileSync(dbPath, entry.getData());
    }

    db = await open({ filename: dbPath, driver: sqlite3.Database });

    const allTables = await db.all(`SELECT name FROM sqlite_master WHERE type='table'`);
    const tableNames = allTables.map((r: any) => r.name);
    const namesTable = tableNames.find((t: string) => /kb_names|names|parties/i.test(t))!;
    const itemsTable = tableNames.find((t: string) => /kb_items|items|products/i.test(t))!;
    const txnsTable = tableNames.find((t: string) => /kb_transactions|transactions/i.test(t))!;
    const lineItemsTable = tableNames.find((t: string) => /kb_lineitems|lineitems/i.test(t));
    const paymentTypesTable = tableNames.find((t: string) => /kb_paymentTypes|payment_types/i.test(t));

    if (!namesTable || !itemsTable || !txnsTable)
      throw new Error("Required tables missing");

    const partiesCol = await getCollection(COLLECTIONS.PARTIES);
    const productsCol = await getCollection(COLLECTIONS.PRODUCTS);
    const ordersCol = await getCollection(COLLECTIONS.ORDERS);
    const purchaseCol = await getCollection(COLLECTIONS.PURCHASE_BILLS);
    const txnCol = await getCollection(COLLECTIONS.PARTY_TRANSACTIONS);
    const expenseCol = await getCollection(COLLECTIONS.EXPENSES);
    const paymentMethodCol = await getCollection(COLLECTIONS.PAYMENT_METHOD);
    const ledgerEntriesCol = await getCollection(COLLECTIONS.PARTY_LEDGER_ENTRIES);
    const balanceStateCol = await getCollection(COLLECTIONS.PARTY_BALANCE_STATE);

    const summary = {
      parties: 0, ledgers: 0, products: 0,
      sales: 0, purchases: 0, payments_in: 0, payments_out: 0, expenses: 0,
      skipped: 0, skipped_details: [] as any[]
    };

    // ------------- 1. parties & ledgers -------------
    const names = await db.all(`SELECT * FROM ${namesTable}`);
    const partyMap = new Map();

    for (const row of names) {
      const name = str(first(row, ["full_name", "name", "party_name"]));
      const nameId = str(first(row, ["name_id", "id", "party_id"]));
      if (!name || !nameId) continue;

      const isLedger = isLedgerName(name);
      const openingBalance = num(first(row, ["opening_balance", "balance"]));
      const openingType = str(first(row, ["opening_balance_type", "opening_balance_drcr"]));
      let balance = openingBalance;
      if (balance > 0 && normalize(openingType).includes("cr")) balance = -balance;

      const filter = { user_id: toObjectId(user.id), source_name_id: nameId, source: "vyapar" };
      const update = {
        $set: {
          name,
          source_name_id: nameId,
          source: "vyapar",
          is_ledger: isLedger,
          opening_balance: balance,
          balance: balance, // initial balance
          phone: str(first(row, ["phone", "mobile"])) || null,
          email: null,
          company_name: null,
          status: "active",
          updated_at: new Date()
        },
        $setOnInsert: { user_id: toObjectId(user.id), created_at: new Date() }
      };
      await partiesCol.updateOne(filter, update, { upsert: true });

      const saved = await partiesCol.findOne(filter);
      if (saved) {
        partyMap.set(nameId, saved);
        partyMap.set(normalize(name), saved);
      }

      if (isLedger) summary.ledgers++;
      else summary.parties++;
    }

    // ------------- 2. products -------------
    const items = await db.all(`SELECT * FROM ${itemsTable}`);
    const productMap = new Map();

    for (const row of items) {
      const name = str(first(row, ["item_name", "name", "product_name"]));
      if (!name) continue;

      const purchasePrice = num(first(row, ["item_purchase_unit_price", "purchase_price", "cost_price"]));
      const salePrice = num(first(row, ["item_sale_unit_price", "sale_price", "selling_price"]));
      const stock = num(first(row, ["item_stock_quantity", "stock", "quantity"]));

      const filter = { user_id: toObjectId(user.id), name };
      const update = {
        $set: {
          name,
          purchase_price: purchasePrice,
          sale_price: salePrice,
          stock,
          source: "vyapar",
          updated_at: new Date()
        },
        $setOnInsert: { user_id: toObjectId(user.id), created_at: new Date() }
      };
      await productsCol.updateOne(filter, update, { upsert: true });

      const saved = await productsCol.findOne(filter);
      if (saved) productMap.set(normalize(name), saved);

      summary.products++;
    }

    // ------------- 3. line items -------------
    let lineItemsRaw: any[] = [];
    let useJoin = false;
    let itemIdCol = "";

    if (lineItemsTable) {
      lineItemsRaw = await db.all(`SELECT * FROM ${lineItemsTable}`);
      const sample = lineItemsRaw[0];
      if (sample && (sample.lineitem_item_id || sample.item_id)) {
        useJoin = true;
        itemIdCol = sample.lineitem_item_id ? "lineitem_item_id" : "item_id";
      }
    }

    const getEnrichedItems = async (txnId: string | number) => {
      const txnIdStr = String(txnId);
      const rawLines = lineItemsRaw.filter(l =>
        String(first(l, ["lineitem_txn_id", "txn_id", "transaction_id"])) === txnIdStr
      );

      const enriched = [];
      for (const line of rawLines) {
        let productId: ObjectId | null = null;
        let productName = "";

        if (useJoin && line[itemIdCol]) {
          const masterItem = await db.get(
            `SELECT * FROM ${itemsTable} WHERE ${/item_id/i.test(itemIdCol) ? "item_id" : "id"} = ?`,
            line[itemIdCol]
          );
          if (masterItem) {
            productName = str(first(masterItem, ["item_name", "name"]));
            const prod = productMap.get(normalize(productName));
            if (prod) productId = prod._id;
          } else {
            productName = str(first(line, ["item_name", "name", "product_name"]));
            const prod = productMap.get(normalize(productName));
            if (prod) productId = prod._id;
          }
        } else {
          productName = str(first(line, ["item_name", "name", "product_name"]));
          const prod = productMap.get(normalize(productName));
          if (prod) productId = prod._id;
        }

        const qty = num(first(line, ["quantity", "qty", "item_quantity"])) || 1;
        const price = num(first(line, ["priceperunit", "rate", "price"]));
        enriched.push({
          product_id: productId ? productId.toString() : null,
          product_name: productName || "Unknown",
          quantity: qty,
          cost_price: price,
          amount: qty * price,
          discount: 0,
          tax: 0,
          total_amount: qty * price
        });
      }
      return enriched;
    }

    // ------------- ledger helper with party balance update -------------
    const createLedgerEntry = async (
      partyId: ObjectId,
      amountDelta: number,
      eventType: string,
      eventSource: string,
      eventSourceId: string,
      effectiveAt: Date,
      metadata: any = {}
    ) => {
      // update balance state
      const balanceState = await balanceStateCol.findOne({ user_id: toObjectId(user.id), party_id: partyId });
      const currentBalance = balanceState?.balance || 0;
      const newBalance = currentBalance + amountDelta;

      await ledgerEntriesCol.insertOne({
        user_id: toObjectId(user.id),
        party_id: partyId,
        event_key: `${eventSource}_${eventSourceId}_${Date.now()}`,
        event_type: eventType,
        event_source: eventSource,
        event_source_id: eventSourceId,
        amount_delta: amountDelta,
        effective_at: effectiveAt,
        running_balance: newBalance,
        created_at: new Date(),
        metadata
      });

      await balanceStateCol.updateOne(
        { user_id: toObjectId(user.id), party_id: partyId },
        { $set: { balance: newBalance, updated_at: new Date() } },
        { upsert: true }
      );

      // ALSO update the party document's balance field
      await partiesCol.updateOne(
        { _id: partyId },
        { $set: { balance: newBalance, updated_at: new Date() } }
      );
    }

    // ------------- 4. transactions -------------
    const txns = await db.all(`SELECT * FROM ${txnsTable}`);
    for (const t of txns) {
      const txnId = first(t, ["txn_id", "id", "transaction_id"]);
      const rawType = Number(first(t, ["txn_type", "type"]));
      const partyRef = str(first(t, ["txn_name_id", "party_id", "name_id"]));
      const party = partyMap.get(partyRef) || partyMap.get(normalize(partyRef));
      const amount = num(first(t, ["txn_balance_amount", "txn_cash_amount", "amount"]));
      const txnDate = getTxnDate(t);
      const paymentMethodId = getPaymentMethodId(t);
      const items = await getEnrichedItems(txnId);
      const hasItems = items.length > 0;

      console.log(`🔍 TXN ${txnId} | type=${rawType} | party=${party?.name || "none"} | items=${items.length} | amount=${amount}`);

      if (!party && rawType !== 7) {
        summary.skipped++;
        summary.skipped_details.push({ txnId, reason: "NO_PARTY" });
        continue;
      }

      // SALE
      if (rawType === 1) {
        const orderResult = await ordersCol.insertOne({
          user_id: toObjectId(user.id),
          customer_id: party?._id || null,
          customer_name: party?.name || null,
          total_amount: amount,
          items: items.map(i => ({
            product_id: i.product_id,
            name: i.product_name,
            quantity: i.quantity,
            price: i.cost_price,
            discount: i.discount,
            tax: i.tax
          })),
          date: txnDate,
          created_at: txnDate,
          source: "vyapar",
          status: "completed"
        });

        if (party && !party.is_ledger) {
          await createLedgerEntry(party._id, amount, "sale", "order", orderResult.insertedId.toString(), txnDate, { txn_id: txnId });
        }
        summary.sales++;
        continue;
      }

      // TYPE 2: purchase (if items) else payment-in
      if (rawType === 2) {
        if (hasItems) {
          const purchaseResult = await purchaseCol.insertOne({
            user_id: toObjectId(user.id),
            party_id: party?._id || null,
            party_name: party?.name || null,
            items: items.map(i => ({
              product_id: i.product_id,
              product_name: i.product_name,
              quantity: i.quantity,
              cost_price: i.cost_price,
              amount: i.amount,
              discount: i.discount,
              tax: i.tax,
              total_amount: i.amount
            })),
            total_amount: amount,
            paid_amount: 0,
            balance_due: amount,
            is_paid: false,
            payment_method_id: paymentMethodId,
            date: txnDate,
            source: "vyapar",
            bill_type: "purchase",
            created_at: txnDate,
            updated_at: txnDate
          });

          if (party && !party.is_ledger) {
            // Purchase increases liability -> party balance decreases (more negative)
            await createLedgerEntry(party._id, -amount, "purchase", "purchase_bill", purchaseResult.insertedId.toString(), txnDate, { txn_id: txnId });
          }
          summary.purchases++;
        } else {
          const txnResult = await txnCol.insertOne({
            user_id: toObjectId(user.id),
            customer_id: party?._id || null,
            customer_name: party?.name || null,
            payment_amount: amount,
            payment_method_id: paymentMethodId,
            type: "payment-in",
            date: txnDate,
            created_at: txnDate,
            source: "vyapar"
          });

          if (party && !party.is_ledger) {
            // Payment-in reduces customer's due -> party balance decreases
            await createLedgerEntry(party._id, -amount, "payment_in", "party_transaction", txnResult.insertedId.toString(), txnDate, { txn_id: txnId });
          }
          summary.payments_in++;
        }
        continue;
      }

      // TYPE 3: purchase return (if items) else payment-out
      if (rawType === 3) {
        if (hasItems) {
          const returnResult = await purchaseCol.insertOne({
            user_id: toObjectId(user.id),
            party_id: party?._id || null,
            party_name: party?.name || null,
            items: items.map(i => ({
              product_id: i.product_id,
              product_name: i.product_name,
              quantity: i.quantity,
              cost_price: i.cost_price,
              amount: i.amount,
              discount: i.discount,
              tax: i.tax,
              total_amount: i.amount
            })),
            total_amount: amount,
            paid_amount: 0,
            balance_due: amount,
            is_paid: false,
            payment_method_id: paymentMethodId,
            date: txnDate,
            source: "vyapar",
            bill_type: "purchase-return",
            created_at: txnDate
          });

          if (party && !party.is_ledger) {
            // Purchase return reduces liability -> party balance increases
            await createLedgerEntry(party._id, amount, "purchase_return", "purchase_bill", returnResult.insertedId.toString(), txnDate, { txn_id: txnId });
          }
          summary.purchases++;
        } else {
          // Payment-out: business pays party (vendor or customer refund)
          const txnResult = await txnCol.insertOne({
            user_id: toObjectId(user.id),
            customer_id: party?._id || null,
            customer_name: party?.name || null,
            payment_amount: amount,
            payment_method_id: paymentMethodId,
            type: "payment-out",
            date: txnDate,
            created_at: txnDate,
            source: "vyapar"
          });

          if (party && !party.is_ledger) {
            // Payment-out reduces what business owes (if vendor) or increases refund due? Standard: payment-out decreases liability, so party balance increases.
            await createLedgerEntry(party._id, amount, "payment_out", "party_transaction", txnResult.insertedId.toString(), txnDate, { txn_id: txnId });
          }
          summary.payments_out++;
        }
        continue;
      }

      // EXPENSE (skip if amount = 0)
      if (rawType === 4) {
        if (amount === 0) {
          console.log(`⚠️ Skipping expense with zero amount for txn ${txnId}`);
          summary.skipped++;
          summary.skipped_details.push({ txnId, reason: "EXPENSE_AMOUNT_ZERO" });
          continue;
        }
        const note = str(first(t, ["txn_note", "note", "description"]));
        const category = (party?.is_ledger ? party.name : "General") || "General";
        const itemName = note || (party?.is_ledger ? party.name : "Expense") || "Expense";
        const qty = items.reduce((s, i) => s + i.quantity, 0) || 1;
        const rate = qty > 0 ? amount / qty : amount;
        const expenseNumber = generateExpenseNumber(txnId, txnDate);

        await expenseCol.insertOne({
          user_id: toObjectId(user.id),
          expense_number: expenseNumber,
          date: txnDate,
          created_at: txnDate,
          updated_at: txnDate,
          category,
          item_name: itemName,
          description: itemName,
          qty,
          rate,
          amount,
          source: "vyapar"
        });
        summary.expenses++;
        continue;
      }

      // UNSUPPORTED
      summary.skipped++;
      summary.skipped_details.push({ txnId, rawType, reason: "UNSUPPORTED" });
    }

    // payment methods
    if (paymentTypesTable) {
      const pms = await db.all(`SELECT * FROM ${paymentTypesTable}`);
      for (const pm of pms) {
        const name = str(first(pm, ["paymenttype_name", "name"]));
        if (!name) continue;
        const details = str(first(pm, ["paymenttype_details", "details"])) || null;
        await paymentMethodCol.updateOne(
          { user_id: toObjectId(user.id), bank_name: name },
          {
            $set: { bank_name: name, bank_details: details, source: "vyapar", updated_at: new Date() },
            $setOnInsert: { user_id: toObjectId(user.id), created_at: new Date() }
          },
          { upsert: true }
        );
      }
    }

    console.log("🎉 FINAL SUMMARY:", JSON.stringify(summary, null, 2));
    return NextResponse.json({ success: true, summary });

  } catch (err: any) {
    console.error("❌ IMPORT ERROR:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    if (db) await db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}