import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { ObjectId } from 'mongodb';

import { getCurrentUser } from '@/lib/auth/utils';
import { getCollection, COLLECTIONS, toObjectId, updateUserLastActivity } from '@/lib/db/mongodb';
import { getBranchName, getPriceFields, getProductDescription } from './import-mapping';

const str = (value: any) => (value == null ? '' : String(value).trim());
const num = (value: any) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

function first(row: any, keys: string[]) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return '';
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function parseDate(value: any) {
  if (value instanceof Date) return isNaN(value.getTime()) ? new Date() : value;
  const text = str(value);
  if (!text) return new Date();
  const parsed = new Date(text);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

function findTable(tableNames: string[], pattern: RegExp) {
  return tableNames.find((name) => pattern.test(name)) || '';
}

function isPaymentMethodAccount(row: any) {
  const text = normalize([first(row, ['Category']), first(row, ['Type']), first(row, ['Name'])].filter(Boolean).join(' '));
  return text.includes('cash') || text.includes('bank');
}

function isLikelyPartyAccount(row: any) {
  const text = normalize([first(row, ['Category']), first(row, ['Type']), first(row, ['Name'])].filter(Boolean).join(' '));
  return [
    'debtor', 'creditor', 'customer', 'supplier', 'party', 'vendor',
    'client', 'buyer', 'seller', 'dealer', 'wholesaler', 'retailer',
    'receivable', 'payable', 'sundry'
  ].some((token) => text.includes(token));
}

function resolvePaymentMethodId(paymentMethodsByName: Map<string, string>, accountName: string) {
  const normalized = normalize(accountName);
  return paymentMethodsByName.get(normalized) || accountName || 'cash';
}

export async function POST(req: NextRequest) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmbk-'));
  let db: any = null;

  try {
    const user = (await getCurrentUser()) as { id: string } | null;
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = path.join(tempDir, file.name || 'data.BMBK');
    fs.writeFileSync(filePath, buffer);

    db = await open({ filename: filePath, driver: sqlite3.Database });

    const tables = await db.all(`SELECT name FROM sqlite_master WHERE type IN ('table', 'view') ORDER BY type, name`);
    const tableNames = tables.map((row: any) => row.name as string);

    const accountTable = findTable(tableNames, /^Account$/i);
    const itemTable = findTable(tableNames, /^Item$/i);
    const salesTable = findTable(tableNames, /^Sales$/i);
    const salesDetailTable = findTable(tableNames, /^SalesDetail$/i);
    const purchaseTable = findTable(tableNames, /^Purchase$/i);
    const purchaseDetailTable = findTable(tableNames, /^PurchaseDetail$/i);
    const paymentTable = findTable(tableNames, /^Payment$/i);
    const paymentDetailTable = findTable(tableNames, /^PaymentDetail$/i);
    const receiptTable = findTable(tableNames, /^Receipt$/i);
    const receiptDetailTable = findTable(tableNames, /^ReceiptDetail$/i);
    const expenseTable = findTable(tableNames, /^Expense$/i);
    const expenseDetailTable = findTable(tableNames, /^ExpenseDetail$/i);

    if (!accountTable || !itemTable || !salesTable || !salesDetailTable || !purchaseTable || !purchaseDetailTable) {
      throw new Error('Required BMBK tables are missing');
    }

    const partiesCol = await getCollection(COLLECTIONS.PARTIES);
    const productsCol = await getCollection(COLLECTIONS.PRODUCTS);
    const ordersCol = await getCollection(COLLECTIONS.ORDERS);
    const purchaseCol = await getCollection(COLLECTIONS.PURCHASE_BILLS);
    const txnCol = await getCollection(COLLECTIONS.PARTY_TRANSACTIONS);
    const paymentMethodCol = await getCollection(COLLECTIONS.PAYMENT_METHOD);
    const expensesCol = await getCollection(COLLECTIONS.EXPENSES);
    const ledgerEntriesCol = await getCollection(COLLECTIONS.PARTY_LEDGER_ENTRIES);
    const balanceStateCol = await getCollection(COLLECTIONS.PARTY_BALANCE_STATE);

    const summary = {
      parties: 0,
      expense_categories: 0,
      products: 0,
      sales: 0,
      purchases: 0,
      payments_in: 0,
      payments_out: 0,
      expenses: 0,
      skipped: 0,
    };

    const userId = toObjectId(user.id);
    const now = new Date();

    const accounts = await db.all(`SELECT * FROM [${accountTable}]`);
    const paymentMethodUpserts: any[] = [];
    const partyUpserts: any[] = [];
    const partyOpeningBalanceByName = new Map<string, number>();
    const partyKindByName = new Map<string, string>();

    for (const row of accounts) {
      const name = str(first(row, ['Name']));
      if (!name) continue;

      const category = str(first(row, ['Category']));
      const type = str(first(row, ['Type']));
      const code = first(row, ['Code']);
      const phone = str(first(row, ['Contact']));
      const address = str(first(row, ['Address']));
      const city = str(first(row, ['City']));
      const openingDebit = num(first(row, ['OpeningDebit']));
      const openingCredit = num(first(row, ['OpeningCredit']));
      const openingBalance = openingDebit - openingCredit;
      const normalizedName = normalize(name);

      if (isPaymentMethodAccount(row)) {
        paymentMethodUpserts.push({
          updateOne: {
            filter: { user_id: userId, bank_name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
            update: {
              $set: {
                bank_name: name,
                bank_details: [category, type, address, city].filter(Boolean).join(' | ') || type || category || '',
                source: 'bmbk',
                updated_at: now,
              },
              $setOnInsert: { user_id: userId, created_at: now },
            },
            upsert: true,
          },
        });
        continue;
      }

      const isParty = isLikelyPartyAccount(row);
      const status = isParty ? 'active' : 'inactive';

      partyOpeningBalanceByName.set(normalizedName, openingBalance);
      partyKindByName.set(normalizedName, isParty ? 'party' : 'system');

      partyUpserts.push({
        updateOne: {
          filter: { user_id: userId, source: 'bmbk', source_account_name: name },
          update: {
            $set: {
              name,
              source: 'bmbk',
              source_account_name: name,
              source_account_code: code != null && code !== '' ? String(code) : null,
              account_category: category || null,
              account_type: type || null,
              company_address: [address, city].filter(Boolean).join(', ') || null,
              phone: phone || null,
              opening_balance: openingBalance,
              balance: openingBalance,
              status,
              is_active: isParty,
              updated_at: now,
            },
            $setOnInsert: { user_id: userId, created_at: now },
          },
          upsert: true,
        },
      });
      summary.parties++;
    }

    if (paymentMethodUpserts.length) {
      await paymentMethodCol.bulkWrite(paymentMethodUpserts, { ordered: false });
    }

    if (partyUpserts.length) {
      await partiesCol.bulkWrite(partyUpserts, { ordered: false });
    }

    const savedParties = await partiesCol.find({ user_id: userId, source: 'bmbk' }).toArray();
    const partyMap = new Map<string, any>();
    const balanceCache = new Map<string, number>();
    const partyIdMap = new Map<string, ObjectId>();

    for (const party of savedParties) {
      const keys = [
        normalize(party.name || ''),
        normalize(party.source_account_name || ''),
      ];
      for (const key of keys) {
        if (key) partyMap.set(key, party);
      }

      const openingBalance = partyOpeningBalanceByName.get(normalize(party.source_account_name || party.name || '')) ?? Number(party.opening_balance || 0);
      balanceCache.set(party._id.toString(), openingBalance);
      partyIdMap.set(party._id.toString(), party._id as ObjectId);
    }

    const paymentMethods = await paymentMethodCol.find({ user_id: userId, source: 'bmbk' }).toArray();
    const paymentMethodsByName = new Map<string, string>();
    for (const method of paymentMethods) {
      paymentMethodsByName.set(normalize(method.bank_name || ''), method._id.toString());
    }

    const products = await db.all(`SELECT * FROM [${itemTable}]`);
    const productUpserts: any[] = [];
    for (const row of products) {
      const name = str(first(row, ['Description']));
      if (!name) continue;

      const code = first(row, ['Code']);
      const category = str(first(row, ['Category'])) || 'General';
      const brand = str(first(row, ['Brand']));
      const openingQty = num(first(row, ['OpeningQty']));
      const { costPrice, sellPrice } = getPriceFields(row);
      const unit = str(first(row, ['Unit'])) || 'PCS';
      const minStock = num(first(row, ['MinimumStock']));
      const description = getProductDescription(name, str(first(row, ['Description2'])) || str(first(row, ['Remarks'])) || str(first(row, ['Narration'])) || '');

      productUpserts.push({
        updateOne: {
          filter: { user_id: userId, source: 'bmbk', source_item_code: code != null && code !== '' ? String(code) : name },
          update: {
            $set: {
              name,
              description,
              category,
              branch: getBranchName(brand),
              type: 'goods',
              cost_price: Math.round(costPrice || 0),
              sell_price: Math.round(sellPrice || costPrice || 0),
              quantity: openingQty,
              unit_of_measurement: unit,
              min_stock_quantity: minStock,
              source: 'bmbk',
              source_item_code: code != null && code !== '' ? String(code) : null,
              updated_at: now,
            },
            $setOnInsert: { user_id: userId, created_at: now },
          },
          upsert: true,
        },
      });
      summary.products++;
    }

    if (productUpserts.length) {
      await productsCol.bulkWrite(productUpserts, { ordered: false });
    }

    const savedProducts = await productsCol.find({ user_id: userId, source: 'bmbk' }).toArray();
    const productMap = new Map<string, any>();
    for (const product of savedProducts) {
      productMap.set(normalize(product.name || ''), product);
      productMap.set(normalize(product.description || ''), product);
      if (product.source_item_code) productMap.set(normalize(String(product.source_item_code)), product);
    }

    const salesRows = await db.all(`SELECT * FROM [${salesTable}]`);
    const salesDetails = await db.all(`SELECT * FROM [${salesDetailTable}]`);
    const salesDetailsBySaleId = new Map<string, any[]>();
    for (const detail of salesDetails) {
      const saleId = str(first(detail, ['SalesId']));
      if (!salesDetailsBySaleId.has(saleId)) salesDetailsBySaleId.set(saleId, []);
      salesDetailsBySaleId.get(saleId)!.push(detail);
    }

    const purchaseRows = await db.all(`SELECT * FROM [${purchaseTable}]`);
    const purchaseDetails = await db.all(`SELECT * FROM [${purchaseDetailTable}]`);
    const purchaseDetailsByPurchaseId = new Map<string, any[]>();
    for (const detail of purchaseDetails) {
      const purchaseId = str(first(detail, ['PurchaseId']));
      if (!purchaseDetailsByPurchaseId.has(purchaseId)) purchaseDetailsByPurchaseId.set(purchaseId, []);
      purchaseDetailsByPurchaseId.get(purchaseId)!.push(detail);
    }

    const paymentRows = paymentTable ? await db.all(`SELECT * FROM [${paymentTable}]`) : [];
    const paymentDetails = paymentDetailTable ? await db.all(`SELECT * FROM [${paymentDetailTable}]`) : [];
    const paymentDetailsByPaymentId = new Map<string, any[]>();
    for (const detail of paymentDetails) {
      const paymentId = str(first(detail, ['PaymentId']));
      if (!paymentDetailsByPaymentId.has(paymentId)) paymentDetailsByPaymentId.set(paymentId, []);
      paymentDetailsByPaymentId.get(paymentId)!.push(detail);
    }

    const receiptRows = receiptTable ? await db.all(`SELECT * FROM [${receiptTable}]`) : [];
    const receiptDetails = receiptDetailTable ? await db.all(`SELECT * FROM [${receiptDetailTable}]`) : [];
    const receiptDetailsByReceiptId = new Map<string, any[]>();
    const expenseRows = expenseTable ? await db.all(`SELECT * FROM [${expenseTable}]`) : [];
    const expenseDetails = expenseDetailTable ? await db.all(`SELECT * FROM [${expenseDetailTable}]`) : [];
    for (const detail of receiptDetails) {
      const receiptId = str(first(detail, ['ReceiptId']));
      if (!receiptDetailsByReceiptId.has(receiptId)) receiptDetailsByReceiptId.set(receiptId, []);
      receiptDetailsByReceiptId.get(receiptId)!.push(detail);
    }

    const expenseDetailsByExpenseId = new Map<string, any[]>();
    for (const detail of expenseDetails) {
      const expenseId = str(first(detail, ['ExpenseId']));
      if (!expenseDetailsByExpenseId.has(expenseId)) expenseDetailsByExpenseId.set(expenseId, []);
      expenseDetailsByExpenseId.get(expenseId)!.push(detail);
    }

    const orderDocs: any[] = [];
    const purchaseDocs: any[] = [];
    const txnDocs: any[] = [];
    const ledgerDocs: any[] = [];
    const expenseDocs: any[] = [];

    const addLedgerEntry = (partyId: ObjectId, amountDelta: number, eventType: string, eventSource: string, eventSourceId: string, effectiveAt: Date, metadata: any = {}) => {
      const key = partyId.toString();
      const currentBalance = balanceCache.get(key) ?? 0;
      const newBalance = currentBalance + amountDelta;
      balanceCache.set(key, newBalance);
      partyIdMap.set(key, partyId);

      ledgerDocs.push({
        user_id: userId,
        party_id: partyId,
        event_key: `${eventSource}_${eventSourceId}`,
        event_type: eventType,
        event_source: eventSource,
        event_source_id: eventSourceId,
        amount_delta: amountDelta,
        effective_at: effectiveAt,
        running_balance: newBalance,
        created_at: new Date(),
        metadata,
      });
    };

    const buildItems = (rows: any[], sourceIdKey: string) => rows.map((detail) => {
      const detailName = str(first(detail, ['Item']));
      const product = productMap.get(normalize(detailName)) || productMap.get(normalize(str(first(detail, ['Description']))));
      const quantity = num(first(detail, ['Qty'])) || 1;
      const rate = num(first(detail, ['Rate'])) || num(first(detail, ['Price'])) || 0;
      const amount = num(first(detail, ['NetAmount'])) || num(first(detail, ['Amount'])) || quantity * rate;
      const productDescription = getProductDescription(product?.name || detailName, product?.description || str(first(detail, ['Description'])) || '');

      return {
        product_id: product?._id || new ObjectId(),
        name: product?.name || detailName || 'Unknown',
        description: productDescription,
        quantity,
        price: rate,
        quantityType: 'pcs',
        unit_of_measurement: product?.unit_of_measurement || null,
        discount: num(first(detail, ['DiscountAmount'])) || 0,
        discountType: 'fixed',
        productId: product?._id ? product._id.toString() : '',
        productName: product?.name || detailName || 'Unknown',
        total_amount: amount,
        amount,
      };
    });

    for (const row of salesRows) {
      const saleId = str(first(row, ['Serial']));
      const partyName = str(first(row, ['Party']));
      const saleDate = parseDate(first(row, ['Date']));
      const billNo = str(first(row, ['Bill'])) || saleId;
      const receivedAmount = num(first(row, ['Received']));
      const receivedInto = str(first(row, ['ReceivedInto']));
      const details = salesDetailsBySaleId.get(saleId) || [];
      const items = buildItems(details, 'SalesId');
      const subtotal = items.reduce((sum, item) => sum + num(item.total_amount || item.amount), 0);
      const totalAmount = subtotal || num(first(row, ['Cartage'])) + receivedAmount;
      const party = partyMap.get(normalize(partyName));

      const orderId = new ObjectId();
      orderDocs.push({
        _id: orderId,
        user_id: userId,
        customer_id: party?._id || null,
        customer_name: party?.name || partyName || null,
        party_id: party?._id || null,
        party_name: party?.name || partyName || null,
        charges: num(first(row, ['Cartage'])) > 0 ? [{ item: 'Cartage', value: Math.round(num(first(row, ['Cartage']))) }] : [],
        due_date: null,
        invoice_no: billNo,
        items: items.map((item) => ({
          product_id: item.product_id,
          name: item.name,
          description: item.description || '',
          quantity: item.quantity,
          price: Math.round(item.price || 0),
          discount: Math.round(item.discount || 0),
          discountType: item.discountType || 'fixed',
          quantityType: item.quantityType || 'pcs',
          unit_of_measurement: item.unit_of_measurement || null,
        })),
        payment: {
          method: receivedInto ? resolvePaymentMethodId(paymentMethodsByName, receivedInto) : null,
          no_payment_at_all: receivedAmount <= 0,
          paid_amount: receivedAmount,
          paid_date: receivedAmount > 0 ? saleDate : null,
        },
        sale_date: saleDate,
        shippingCharges: num(first(row, ['Cartage'])) > 0 ? Math.round(num(first(row, ['Cartage']))) : 0,
        status: 'completed',
        subtotal,
        total_amount: totalAmount,
        created_at: saleDate,
        source: 'bmbk',
      });

      if (party && totalAmount > 0) {
        addLedgerEntry(party._id, totalAmount, 'order_debit', 'order', orderId.toString(), saleDate, { source_sale_id: saleId });
      }

      if (party && receivedAmount > 0) {
        const txnId = new ObjectId();
        txnDocs.push({
          _id: txnId,
          user_id: userId,
          customer_id: party._id,
          customer_name: party.name,
          payment_amount: receivedAmount,
          payment_method_id: resolvePaymentMethodId(paymentMethodsByName, receivedInto),
          type: 'payment-in',
          note: `Sales bill #${billNo}`,
          date: saleDate,
          created_at: saleDate,
          source: 'bmbk',
        });
        addLedgerEntry(party._id, receivedAmount, 'payment_in_credit', 'party_transaction', txnId.toString(), saleDate, { source_sale_id: saleId });
        summary.payments_in++;
      }

      summary.sales++;
    }

    for (const row of purchaseRows) {
      const purchaseIdValue = str(first(row, ['Serial']));
      const partyName = str(first(row, ['Party']));
      const purchaseDate = parseDate(first(row, ['Date']));
      const billNo = str(first(row, ['Bill'])) || purchaseIdValue;
      const paidAmount = num(first(row, ['Paid']));
      const paidFrom = str(first(row, ['PaidFrom']));
      const details = purchaseDetailsByPurchaseId.get(purchaseIdValue) || [];
      const items = buildItems(details, 'PurchaseId');
      const subtotal = items.reduce((sum, item) => sum + num(item.total_amount || item.amount), 0);
      const totalAmount = subtotal || paidAmount;
      const party = partyMap.get(normalize(partyName));

      const purchaseDocId = new ObjectId();
      purchaseDocs.push({
        _id: purchaseDocId,
        user_id: userId,
        party_id: party?._id || null,
        party_name: party?.name || partyName || null,
        items: items.map((item) => ({
          product_id: item.product_id,
          product_name: item.name,
          product_description: item.description || '',
          quantity: item.quantity,
          cost_price: Math.round(item.price || 0),
          amount: num(item.total_amount || item.amount),
        })),
        discount: 0,
        discount_type: 'fixed',
        tax: 0,
        tax_type: 'fixed',
        total_amount: totalAmount,
        paid_amount: paidAmount,
        balance_due: Math.max(totalAmount - paidAmount, 0),
        is_paid: paidAmount >= totalAmount,
        payment_method_id: paidFrom ? resolvePaymentMethodId(paymentMethodsByName, paidFrom) : null,
        payment_method_name: paidFrom || null,
        description: str(first(row, ['Remarks'])) || null,
        created_at: purchaseDate,
        updated_at: purchaseDate,
        source: 'bmbk',
        bill_type: 'purchase',
      });

      if (party && totalAmount > 0) {
        addLedgerEntry(party._id, -totalAmount, 'purchase_bill_credit', 'purchase_bill', purchaseDocId.toString(), purchaseDate, { source_purchase_id: purchaseIdValue });
      }

      if (party && paidAmount > 0) {
        const txnId = new ObjectId();
        txnDocs.push({
          _id: txnId,
          user_id: userId,
          customer_id: party._id,
          customer_name: party.name,
          payment_amount: paidAmount,
          payment_method_id: resolvePaymentMethodId(paymentMethodsByName, paidFrom),
          type: 'payment-out',
          note: `Purchase bill #${billNo}`,
          date: purchaseDate,
          created_at: purchaseDate,
          source: 'bmbk',
        });
        addLedgerEntry(party._id, -paidAmount, 'payment_out_debit', 'party_transaction', txnId.toString(), purchaseDate, { source_purchase_id: purchaseIdValue });
        summary.payments_out++;
      }

      summary.purchases++;
    }

    for (const row of paymentRows) {
      const paymentId = str(first(row, ['Serial']));
      const paymentDate = parseDate(first(row, ['Date']));
      const paidFrom = str(first(row, ['PaidFrom']));
      const details = paymentDetailsByPaymentId.get(paymentId) || [];
      if (!details.length) {
        summary.skipped++;
        continue;
      }

      for (const detail of details) {
        const targetName = str(first(detail, ['PaidTo']));
        const amount = num(first(detail, ['Amount']));
        if (!targetName || amount <= 0) continue;
        const party = partyMap.get(normalize(targetName));
        if (!party) continue;

        const txnId = new ObjectId();
        txnDocs.push({
          _id: txnId,
          user_id: userId,
          customer_id: party._id,
          customer_name: party.name,
          payment_amount: amount,
          payment_method_id: resolvePaymentMethodId(paymentMethodsByName, paidFrom),
          type: 'payment-out',
          note: str(first(detail, ['Narration'])) || `Payment #${paymentId}`,
          date: paymentDate,
          created_at: paymentDate,
          source: 'bmbk',
        });
        addLedgerEntry(party._id, -amount, 'payment_out_debit', 'party_transaction', txnId.toString(), paymentDate, { source_payment_id: paymentId });
        summary.payments_out++;
      }
    }

    for (const row of receiptRows) {
      const receiptId = str(first(row, ['Serial']));
      const receiptDate = parseDate(first(row, ['Date']));
      const receivedInto = str(first(row, ['ReceivedInto']));
      const details = receiptDetailsByReceiptId.get(receiptId) || [];
      if (!details.length) {
        summary.skipped++;
        continue;
      }

      for (const detail of details) {
        const sourceName = str(first(detail, ['ReceivedFrom']));
        const amount = num(first(detail, ['Amount']));
        if (!sourceName || amount <= 0) continue;
        const party = partyMap.get(normalize(sourceName));
        if (!party) continue;

        const txnId = new ObjectId();
        txnDocs.push({
          _id: txnId,
          user_id: userId,
          customer_id: party._id,
          customer_name: party.name,
          payment_amount: amount,
          payment_method_id: resolvePaymentMethodId(paymentMethodsByName, receivedInto),
          type: 'payment-in',
          note: str(first(detail, ['Narration'])) || `Receipt #${receiptId}`,
          date: receiptDate,
          created_at: receiptDate,
          source: 'bmbk',
        });
        addLedgerEntry(party._id, amount, 'payment_in_credit', 'party_transaction', txnId.toString(), receiptDate, { source_receipt_id: receiptId });
        summary.payments_in++;
      }
    }

    for (const row of expenseRows) {
      const expenseId = str(first(row, ['Serial', 'Id', 'No']));
      const expenseDate = parseDate(first(row, ['Date']));
      const partyName = str(first(row, ['Party', 'Supplier', 'Account', 'Name']));
      const amount = num(first(row, ['Amount'])) || num(first(row, ['NetAmount'])) || 0;
      const category = str(first(row, ['Category', 'Type'])) || 'General';
      const itemName = str(first(row, ['Item', 'ItemName', 'Description'])) || category || 'Expense';
      const description = str(first(row, ['Narration', 'Remarks'])) || '';
      const party = partyMap.get(normalize(partyName));
      if (amount <= 0) continue;

      const expenseDoc = {
        user_id: userId,
        expense_number: expenseId || `EXP-${new Date().getTime()}-${expenseDocs.length + 1}`,
        date: expenseDate,
        created_at: expenseDate,
        updated_at: expenseDate,
        category,
        item_name: itemName,
        description,
        qty: num(first(row, ['Qty'])) || 1,
        rate: Math.max(amount, 0),
        amount,
        payment_method: str(first(row, ['PaidFrom', 'PaymentMethod'])) || null,
        party_id: party?._id || null,
        party_name: party?.name || partyName || null,
        source: 'bmbk',
        source_txn_id: expenseId || null,
      };
      expenseDocs.push(expenseDoc);
      if (party) {
        addLedgerEntry(party._id, -amount, 'expense_debit', 'expense', expenseDoc.expense_number, expenseDate, { source_expense_id: expenseId });
      }
      summary.expenses++;
    }

    const writes: Promise<any>[] = [];
    if (orderDocs.length) writes.push(ordersCol.insertMany(orderDocs, { ordered: false }));
    if (purchaseDocs.length) writes.push(purchaseCol.insertMany(purchaseDocs, { ordered: false }));
    if (txnDocs.length) writes.push(txnCol.insertMany(txnDocs, { ordered: false }));
    if (ledgerDocs.length) writes.push(ledgerEntriesCol.insertMany(ledgerDocs, { ordered: false }));
    if (expenseDocs.length) writes.push(expensesCol.insertMany(expenseDocs, { ordered: false }));
    await Promise.all(writes);

    const balanceOps = Array.from(balanceCache.entries()).map(([partyId, balance]) => ({
      updateOne: {
        filter: { user_id: userId, party_id: partyIdMap.get(partyId) },
        update: { $set: { current_balance: balance, updated_at: now } },
        upsert: true,
      },
    }));
    if (balanceOps.length) {
      await balanceStateCol.bulkWrite(balanceOps, { ordered: false });
    }

    await updateUserLastActivity();
    return NextResponse.json({ success: true, summary });
  } catch (error: any) {
    console.error('❌ BMBK IMPORT ERROR:', error);
    return NextResponse.json({ error: error?.message || 'Failed to import BMBK file' }, { status: 500 });
  } finally {
    if (db) await db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';