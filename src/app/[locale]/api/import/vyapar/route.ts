import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import AdmZip from "adm-zip";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { ObjectId } from "mongodb";

import { getCurrentUser } from "@/lib/auth/utils";
import { getCollection, COLLECTIONS, toObjectId, updateUserLastActivity } from "@/lib/db/mongodb";

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
  return `EXP-${date.toISOString().slice(0, 10)}-${txnId}`;
}

// Sum balance + cash amounts — handles all Vyapar txn types correctly:
// Types 3/4/7 store the amount in txn_cash_amount (txn_balance_amount = 0)
// Types 1/2/5/6 may have non-zero in both columns
function getTxnAmount(row: any) {
  const balance = num(first(row, ["txn_balance_amount", "balance_amount"]));
  const cash = num(first(row, ["txn_cash_amount", "cash_amount"]));
  const total = balance + cash;
  return total > 0 ? total : num(first(row, ["amount"]));
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
    const itemsTable = tableNames.find((t: string) => /^(kb_items|items|products)$/i.test(t))!;
    const txnsTable = tableNames.find((t: string) => /^(kb_transactions|transactions?)$/i.test(t))!;
    const lineItemsTable = tableNames.find((t: string) => /kb_lineitems|lineitems/i.test(t));
    const paymentTypesTable = tableNames.find((t: string) => /kb_paymentTypes|payment_types/i.test(t));

    if (!namesTable || !itemsTable || !txnsTable)
      throw new Error("Required tables missing");

    const partiesCol = await getCollection(COLLECTIONS.PARTIES);
    const productsCol = await getCollection(COLLECTIONS.PRODUCTS);
    const ordersCol = await getCollection(COLLECTIONS.ORDERS);
    const saleReturnCol = await getCollection(COLLECTIONS.SALE_RETURN_TRANSACTIONS);
    const purchaseCol = await getCollection(COLLECTIONS.PURCHASE_BILLS);
    const txnCol = await getCollection(COLLECTIONS.PARTY_TRANSACTIONS);
    const expenseCol = await getCollection(COLLECTIONS.EXPENSES);
    const paymentMethodCol = await getCollection(COLLECTIONS.PAYMENT_METHOD);
    const ledgerEntriesCol = await getCollection(COLLECTIONS.PARTY_LEDGER_ENTRIES);
    const balanceStateCol = await getCollection(COLLECTIONS.PARTY_BALANCE_STATE);

    const summary = {
      parties: 0, expense_categories: 0, products: 0,
      sales: 0, purchases: 0, payments_in: 0, payments_out: 0, expenses: 0,
      skipped: 0,
    };

    const userId = toObjectId(user.id);

    // ------------- 1. parties (name_type=1) & expense categories (name_type=2) -------------
    const names = await db.all(`SELECT * FROM ${namesTable}`);

    // name_id → category name, used when a transaction references an expense category
    const expenseCategoryMap = new Map<string, string>();
    const partyUpserts: any[] = [];

    for (const row of names) {
      const name = str(first(row, ["full_name", "name", "party_name"]));
      const nameId = str(first(row, ["name_id", "id", "party_id"]));
      if (!name || !nameId) continue;

      const nameType = num(first(row, ["name_type"]));

      // name_type=2 → expense category, not a real party
      if (nameType === 2) {
        expenseCategoryMap.set(nameId, name);
        summary.expense_categories++;
        continue;
      }

      // only name_type=1 are real parties — skip everything else
      if (nameType !== 1) continue;

      const balance = num(first(row, ["amount", "opening_balance", "balance"]));
      const email = str(first(row, ["email"]));
      const phone = str(first(row, ["phone_number", "phone", "mobile"]));
      const address = str(first(row, ["address"]));
      const createdAt = row.date_created ? new Date(row.date_created) : new Date();
      const updatedAt = row.date_modified ? new Date(row.date_modified) : new Date();

      partyUpserts.push({
        updateOne: {
          filter: { user_id: userId, source_name_id: nameId, source: "vyapar" },
          update: {
            $set: {
              name,
              source_name_id: nameId,
              source: "vyapar",
              balance,
              opening_balance: balance,
              phone: phone || null,
              email: email || null,
              company_address: address || null,
              is_active: num(first(row, ["name_is_active"])) !== 0,
              status: "active",
              updated_at: updatedAt
            },
            $setOnInsert: { user_id: userId, created_at: createdAt }
          },
          upsert: true
        }
      });
      summary.parties++;
    }

    if (partyUpserts.length) await partiesCol.bulkWrite(partyUpserts, { ordered: false });

    const partyMap = new Map<string, any>();
    const savedParties = await partiesCol.find({ user_id: userId, source: "vyapar" }).toArray();
    for (const p of savedParties) {
      partyMap.set(p.source_name_id, p);
      partyMap.set(normalize(p.name), p);
    }

    // ------------- 2. products — bulk upsert then single find -------------
    const items = await db.all(`SELECT * FROM ${itemsTable}`);
    const itemByIdMap = new Map<string, any>();
    const productUpserts: any[] = [];

    for (const row of items) {
      const name = str(first(row, ["item_name", "name", "product_name"]));
      if (!name) continue;

      const id = first(row, ["item_id", "id"]);
      if (id) itemByIdMap.set(String(id), row);

      const qty = num(first(row, ["item_stock_quantity", "stock", "quantity"]));
      const itemTypeNum = num(first(row, ["item_type"]));
      const itemCode = str(first(row, ["item_code"]));
      const description = str(first(row, ["item_description", "description"]));
      const location = str(first(row, ["item_location", "location"]));
      const hsnCode = str(first(row, ["item_hsn_sac_code"]));
      const minStock = num(first(row, ["item_min_stock_quantity"]));
      const mrpRaw = first(row, ["item_mrp"]);
      const wholesalePriceRaw = first(row, ["item_wholesale_price"]);
      const minWholesaleQtyRaw = first(row, ["item_min_wholesale_qty"]);
      const isActive = num(first(row, ["item_is_active"]));
      const itemCreatedAt = row.item_date_created ? new Date(row.item_date_created) : new Date();
      const itemModifiedAt = row.item_date_modified ? new Date(row.item_date_modified) : new Date();

      const setFields: any = {
        name,
        type: itemTypeNum === 2 ? "services" : "goods",
        sell_price: num(first(row, ["item_sale_unit_price", "sale_price", "selling_price"])),
        cost_price: num(first(row, ["item_purchase_unit_price", "purchase_price", "cost_price"])),
        quantity: qty,
        in_stock: qty,
        is_active: isActive !== 0,
        discount: num(first(row, ["item_discount"])),
        discount_type: num(first(row, ["item_discount_type"])),
        source: "vyapar",
        source_item_id: id ? String(id) : undefined,
        branch: "Main",
        category: "General",
        updated_at: itemModifiedAt
      };

      if (itemCode) setFields.sku = itemCode;
      if (description) setFields.description = description;
      if (location) setFields.branch = location;
      if (hsnCode) setFields.hsn_code = hsnCode;
      if (minStock) setFields.min_stock_quantity = minStock;
      if (mrpRaw != null && mrpRaw !== "") setFields.mrp = num(mrpRaw);
      if (wholesalePriceRaw != null && wholesalePriceRaw !== "") setFields.wholesale_price = num(wholesalePriceRaw);
      if (minWholesaleQtyRaw != null && minWholesaleQtyRaw !== "") setFields.min_wholesale_qty = num(minWholesaleQtyRaw);

      productUpserts.push({
        updateOne: {
          filter: id
            ? { user_id: userId, source: "vyapar", source_item_id: String(id) }
            : { user_id: userId, name },
          update: {
            $set: setFields,
            $setOnInsert: { user_id: userId, created_at: itemCreatedAt }
          },
          upsert: true
        }
      });
      summary.products++;
    }

    if (productUpserts.length) await productsCol.bulkWrite(productUpserts, { ordered: false });

    const productMap = new Map<string, any>();
    const savedProducts = await productsCol.find({ user_id: userId, source: "vyapar" }).toArray();
    for (const p of savedProducts) productMap.set(normalize(p.name), p);

    // ------------- 3. line items — pre-index by txn ID -------------
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

    const lineItemsByTxnId = new Map<string, any[]>();
    for (const line of lineItemsRaw) {
      const tid = String(first(line, ["lineitem_txn_id", "txn_id", "transaction_id"]));
      if (!lineItemsByTxnId.has(tid)) lineItemsByTxnId.set(tid, []);
      lineItemsByTxnId.get(tid)!.push(line);
    }

    const getEnrichedItems = (txnId: string | number) => {
      const rawLines = lineItemsByTxnId.get(String(txnId)) || [];
      return rawLines.map(line => {
        let productId: ObjectId | null = null;
        let productName = "";

        if (useJoin && line[itemIdCol]) {
          const masterItem = itemByIdMap.get(String(line[itemIdCol]));
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
        return {
          product_id: productId ? productId.toString() : null,
          product_name: productName || "Unknown",
          quantity: qty,
          cost_price: price,
          amount: qty * price,
          discount: 0,
          tax: 0,
          total_amount: qty * price
        };
      });
    };

    // ------------- 4. transactions — collect then batch insert -------------
    const txns = await db.all(`SELECT * FROM ${txnsTable}`);

    // In-memory accumulators
    const orderDocs: any[] = [];
    const saleReturnDocs: any[] = [];
    const purchaseDocs: any[] = [];
    const txnDocs: any[] = [];
    const expenseDocs: any[] = [];
    const ledgerEntryDocs: any[] = [];
    // final balance per party (only last value matters for the state snapshot)
    const balanceCache = new Map<string, number>();
    // for each party, track the ObjectId (needed for bulkWrite filter)
    const partyIdMap = new Map<string, ObjectId>();

    const addLedgerEntry = (
      partyId: ObjectId,
      amountDelta: number,
      eventType: string,
      eventSource: string,
      eventSourceId: string,
      effectiveAt: Date,
      metadata: any = {}
    ) => {
      const key = partyId.toString();
      const currentBalance = balanceCache.get(key) ?? 0;
      const newBalance = currentBalance + amountDelta;
      balanceCache.set(key, newBalance);
      partyIdMap.set(key, partyId);

      ledgerEntryDocs.push({
        user_id: userId,
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
    };
    for (const t of txns) {
      const txnId = first(t, ["txn_id", "id", "transaction_id"]);
      const rawType = Number(first(t, ["txn_type", "type"]));
      const partyRef = str(first(t, ["txn_name_id", "party_id", "name_id"]));
      const party = partyMap.get(partyRef) || partyMap.get(normalize(partyRef));
      const amount = getTxnAmount(t);
      const txnDate = getTxnDate(t);
      const paymentMethodId = getPaymentMethodId(t);
      const enrichedItems = getEnrichedItems(txnId);
      
      // SALE
      if (rawType === 1) {
        const orderId = new ObjectId();
        orderDocs.push({
          _id: orderId,
          user_id: userId,
          customer_id: party?._id || null,
          customer_name: party?.name || null,
          total_amount: amount,
          items: enrichedItems.map(i => ({
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

        if (party) {
          addLedgerEntry(party._id, amount, "sale", "order", orderId.toString(), txnDate, { txn_id: txnId });
        }
        summary.sales++;
        continue;
      }

      // TYPE 2: Purchase Bill
      if (rawType === 2) {
        const purchaseId = new ObjectId();
        purchaseDocs.push({
          _id: purchaseId,
          user_id: userId,
          party_id: party?._id || null,
          party_name: party?.name || null,
          items: enrichedItems.map(i => ({
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
        if (party) {
          addLedgerEntry(party._id, -amount, "purchase", "purchase_bill", purchaseId.toString(), txnDate, { txn_id: txnId });
        }
        summary.purchases++;
        continue;
      }

      // TYPE 3: Payment In from customer (cash received)
      if (rawType === 3) {
        const txnDocId = new ObjectId();
        const note = str(first(t, ["txn_description", "note", "description"]));
        txnDocs.push({
          _id: txnDocId,
          user_id: userId,
          customer_id: party?._id || null,
          customer_name: party?.name || null,
          payment_amount: amount,
          payment_method_id: paymentMethodId,
          type: "payment-in",
          note,
          date: txnDate,
          created_at: txnDate,
          source: "vyapar"
        });
        if (party) {
          addLedgerEntry(party._id, amount, "payment_in", "party_transaction", txnDocId.toString(), txnDate, { txn_id: txnId });
        }
        summary.payments_in++;
        continue;
      }

      // TYPE 4: Payment Out to supplier (cash paid)
      if (rawType === 4) {
        const txnDocId = new ObjectId();
        const note = str(first(t, ["txn_description", "note", "description"]));
        txnDocs.push({
          _id: txnDocId,
          user_id: userId,
          customer_id: party?._id || null,
          customer_name: party?.name || null,
          payment_amount: amount,
          payment_method_id: paymentMethodId,
          type: "payment-out",
          note,
          date: txnDate,
          created_at: txnDate,
          source: "vyapar"
        });
        if (party) {
          addLedgerEntry(party._id, -amount, "payment_out", "party_transaction", txnDocId.toString(), txnDate, { txn_id: txnId });
        }
        summary.payments_out++;
        continue;
      }

      // EXPENSE (type 7) — each line item is a separate expense category
      if (rawType === 7) {
        const description = str(first(t, ["txn_description", "txn_note", "note", "description"]));

        if (enrichedItems.length > 0) {
          enrichedItems.forEach((item, idx) => {
            const lineAmount = item.total_amount || item.quantity * item.cost_price;
            if (lineAmount === 0) return;
            expenseDocs.push({
              user_id: userId,
              expense_number: generateExpenseNumber(`${txnId}-${idx}`, txnDate),
              date: txnDate,
              created_at: txnDate,
              updated_at: txnDate,
              category: item.product_name || "General",
              item_name: item.product_name || description || "General",
              description: description || "",
              qty: item.quantity,
              rate: item.cost_price,
              amount: lineAmount,
              payment_method: paymentMethodId,
              party_id: party?._id || null,
              party_name: party?.name || null,
              source: "vyapar",
              source_txn_id: String(txnId)
            });
            summary.expenses++;
          });
        } else if (amount > 0) {
          // fallback: no line items, use transaction header amount
          expenseDocs.push({
            user_id: userId,
            expense_number: generateExpenseNumber(txnId, txnDate),
            date: txnDate,
            created_at: txnDate,
            updated_at: txnDate,
            category: "General",
            item_name: description || "Expense",
            description: description || "",
            qty: 1,
            rate: amount,
            amount,
            payment_method: paymentMethodId,
            party_id: party?._id || null,
            party_name: party?.name || null,
            source: "vyapar",
            source_txn_id: String(txnId)
          });
          summary.expenses++;
        }
        continue;
      }

      // PAYMENT IN (type 5) — money owed to us / receivable opening balance
      if (rawType === 5) {
        const txnDocId = new ObjectId();
        const note = str(first(t, ["txn_description", "note", "description"]));
        txnDocs.push({
          _id: txnDocId,
          user_id: userId,
          customer_id: party?._id || null,
          customer_name: party?.name || null,
          payment_amount: amount,
          payment_method_id: paymentMethodId,
          type: "payment-in",
          note,
          date: txnDate,
          created_at: txnDate,
          source: "vyapar"
        });
        if (party) {
          addLedgerEntry(party._id, amount, "payment_in", "party_transaction", txnDocId.toString(), txnDate, { txn_id: txnId });
        }
        summary.payments_in++;
        continue;
      }

      // PAYMENT OUT (type 6) — money we owe / payable opening balance
      if (rawType === 6) {
        const txnDocId = new ObjectId();
        const note = str(first(t, ["txn_description", "note", "description"]));
        txnDocs.push({
          _id: txnDocId,
          user_id: userId,
          customer_id: party?._id || null,
          customer_name: party?.name || null,
          payment_amount: amount,
          payment_method_id: paymentMethodId,
          type: "payment-out",
          note,
          date: txnDate,
          created_at: txnDate,
          source: "vyapar"
        });
        if (party) {
          addLedgerEntry(party._id, -amount, "payment_out", "party_transaction", txnDocId.toString(), txnDate, { txn_id: txnId });
        }
        summary.payments_out++;
        continue;
      }

      // TYPE 8 / 21: Sale Return / Credit Note — goes to SALE_RETURN_TRANSACTIONS, not orders
      if (rawType === 8 || rawType === 21) {
        const returnId = new ObjectId();
        saleReturnDocs.push({
          _id: returnId,
          user_id: userId,
          return_number: `VYP-RET-${txnId}`,
          customer_id: party?._id || null,
          items: enrichedItems.map(i => ({
            id: i.product_id ? i.product_id.toString() : `item-${txnId}`,
            productId: i.product_id ? i.product_id.toString() : "",
            itemName: i.product_name || "Unknown",
            quantity: i.quantity,
            rate: i.cost_price,
            amount: i.total_amount
          })),
          total_amount: amount,
          paid_amount: amount,
          balance_due: 0,
          payment_amount: amount,
          payment_method_id: paymentMethodId,
          invoice_no: str(first(t, ["txn_ref_number_char", "txn_display_name"])) || "",
          invoice_date: txnDate,
          date: txnDate,
          created_at: txnDate,
          updated_at: txnDate,
          source: "vyapar",
          source_txn_id: String(txnId)
        });
        if (party) {
          addLedgerEntry(party._id, -amount, "sale_return", "sale_return_transaction", returnId.toString(), txnDate, { txn_id: txnId });
        }
        summary.sales++;
        continue;
      }

      // TYPE 23: Debit Note (Purchase Return)
      if (rawType === 23) {
        const returnId = new ObjectId();
        purchaseDocs.push({
          _id: returnId,
          user_id: userId,
          party_id: party?._id || null,
          party_name: party?.name || null,
          items: enrichedItems.map(i => ({
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
          bill_type: "debit-note",
          created_at: txnDate
        });
        if (party) {
          addLedgerEntry(party._id, amount, "debit_note", "purchase_bill", returnId.toString(), txnDate, { txn_id: txnId });
        }
        summary.purchases++;
        continue;
      }

      // TYPE 50: Party-to-Party Transfer — sender side (money flows out of this party)
      if (rawType === 50) {
        const txnDocId = new ObjectId();
        const note = str(first(t, ["txn_description", "note", "description"]));
        txnDocs.push({
          _id: txnDocId,
          user_id: userId,
          customer_id: party?._id || null,
          customer_name: party?.name || null,
          payment_amount: amount,
          payment_method_id: paymentMethodId,
          type: "payment-out",
          note,
          date: txnDate,
          created_at: txnDate,
          source: "vyapar"
        });
        if (party) {
          addLedgerEntry(party._id, -amount, "payment_out", "party_transaction", txnDocId.toString(), txnDate, { txn_id: txnId });
        }
        summary.payments_out++;
        continue;
      }

      // TYPE 51: Party-to-Party Transfer — receiver side (money flows into this party)
      if (rawType === 51) {
        const txnDocId = new ObjectId();
        const note = str(first(t, ["txn_description", "note", "description"]));
        txnDocs.push({
          _id: txnDocId,
          user_id: userId,
          customer_id: party?._id || null,
          customer_name: party?.name || null,
          payment_amount: amount,
          payment_method_id: paymentMethodId,
          type: "payment-in",
          note,
          date: txnDate,
          created_at: txnDate,
          source: "vyapar"
        });
        if (party) {
          addLedgerEntry(party._id, amount, "payment_in", "party_transaction", txnDocId.toString(), txnDate, { txn_id: txnId });
        }
        summary.payments_in++;
        continue;
      }

      // TYPE 65: Sale-like entry with invoice and line items
      if (rawType === 65) {
        const orderId = new ObjectId();
        orderDocs.push({
          _id: orderId,
          user_id: userId,
          customer_id: party?._id || null,
          customer_name: party?.name || null,
          total_amount: amount,
          items: enrichedItems.map(i => ({
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
        if (party) {
          addLedgerEntry(party._id, amount, "sale", "order", orderId.toString(), txnDate, { txn_id: txnId });
        }
        summary.sales++;
        continue;
      }

      // TYPE 29: Other-account transfer (name_type=3, no party) — store as payment-in
      if (rawType === 29) {
        const txnDocId = new ObjectId();
        const note = str(first(t, ["txn_description", "note", "description"]));
        txnDocs.push({
          _id: txnDocId,
          user_id: userId,
          customer_id: null,
          customer_name: null,
          payment_amount: amount,
          payment_method_id: paymentMethodId,
          type: "payment-in",
          note,
          date: txnDate,
          created_at: txnDate,
          source: "vyapar"
        });
        summary.payments_in++;
        continue;
      }

      summary.skipped++;
    }

    // ------------- 5. batch writes -------------
    const writes: Promise<any>[] = [];

    if (orderDocs.length)       writes.push(ordersCol.insertMany(orderDocs, { ordered: false }));
    if (saleReturnDocs.length)  writes.push(saleReturnCol.insertMany(saleReturnDocs, { ordered: false }));
    if (purchaseDocs.length)    writes.push(purchaseCol.insertMany(purchaseDocs, { ordered: false }));
    if (txnDocs.length)         writes.push(txnCol.insertMany(txnDocs, { ordered: false }));
    if (expenseDocs.length)     writes.push(expenseCol.insertMany(expenseDocs, { ordered: false }));
    if (ledgerEntryDocs.length) writes.push(ledgerEntriesCol.insertMany(ledgerEntryDocs, { ordered: false }));

    await Promise.all(writes);

    // bulk-update final balance state and party balance
    const now = new Date();

    if (balanceCache.size > 0) {
      const balanceOps = Array.from(balanceCache.entries()).map(([key, balance]) => ({
        updateOne: {
          filter: { user_id: userId, party_id: partyIdMap.get(key)! },
          update: { $set: { balance, updated_at: now } },
          upsert: true
        }
      }));
      await balanceStateCol.bulkWrite(balanceOps, { ordered: false });
    }

    // Use Vyapar's authoritative current balance from kb_names.amount (stored as opening_balance)
    // rather than the ledger-reconstructed value which starts at 0 and misses unhandled txn types
    if (savedParties.length > 0) {
      const partyBalanceOps = savedParties.map(p => ({
        updateOne: {
          filter: { _id: p._id },
          update: { $set: { balance: p.opening_balance ?? 0, updated_at: now } }
        }
      }));
      await partiesCol.bulkWrite(partyBalanceOps, { ordered: false });
    }

    // payment methods
    if (paymentTypesTable) {
      const pms = await db.all(`SELECT * FROM ${paymentTypesTable}`);
      const pmOps = pms
        .map((pm: any) => ({ name: str(first(pm, ["paymenttype_name", "name"])), details: str(first(pm, ["paymenttype_details", "details"])) || null }))
        .filter((pm: any) => pm.name)
        .map(({ name, details }: { name: string; details: string | null }) => ({
          updateOne: {
            filter: { user_id: userId, bank_name: name },
            update: {
              $set: { bank_name: name, bank_details: details, source: "vyapar", updated_at: new Date() },
              $setOnInsert: { user_id: userId, created_at: new Date() }
            },
            upsert: true
          }
        }));
      if (pmOps.length) await paymentMethodCol.bulkWrite(pmOps, { ordered: false });
    }

    await updateUserLastActivity();
    return NextResponse.json({ success: true, summary });

  } catch (err: any) {
    console.error("❌ IMPORT ERROR:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    if (db) await db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
