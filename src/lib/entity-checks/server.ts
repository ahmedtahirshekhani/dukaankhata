import { getCollection, COLLECTIONS, toObjectId, isValidObjectId } from "@/lib/db/mongodb";

export interface ServerEntityTransactionCheckResult {
  hasTransactions: boolean;
  counts: {
    orders: number;
    orderItems: number;
    purchaseBills: number;
    saleReturns: number;
    partyTransactions: number;
    vendorTransactions: number;
    stockAdjustments: number;
    inventoryBatches: number;
    ledgerEntries: number;
    transactions: number;
    quotations: number;
  };
  details: string[];
  summary: string;
}

/**
 * Checks whether a party / customer has any associated transactions in MongoDB across ALL collections.
 */
export async function checkPartyHasTransactionsServer(options: {
  userId: string;
  partyId: string;
}): Promise<ServerEntityTransactionCheckResult> {
  const { userId, partyId } = options;
  const pIdStr = String(partyId).trim();
  const counts = {
    orders: 0,
    orderItems: 0,
    purchaseBills: 0,
    saleReturns: 0,
    partyTransactions: 0,
    vendorTransactions: 0,
    stockAdjustments: 0,
    inventoryBatches: 0,
    ledgerEntries: 0,
    transactions: 0,
    quotations: 0,
  };

  if (!pIdStr) {
    return {
      hasTransactions: false,
      counts,
      details: [],
      summary: "",
    };
  }

  const userMatches: any[] = [userId];
  if (isValidObjectId(userId)) {
    userMatches.push(toObjectId(userId));
  }

  const partyMatches: any[] = [pIdStr];
  if (isValidObjectId(pIdStr)) {
    partyMatches.push(toObjectId(pIdStr));
  }

  // 1. Orders / Invoices
  try {
    const ordersCol = await getCollection(COLLECTIONS.ORDERS);
    counts.orders = await ordersCol.countDocuments({
      user_id: { $in: userMatches },
      $or: [
        { customer_id: { $in: partyMatches } },
        { customerId: { $in: partyMatches } },
        { party_id: { $in: partyMatches } },
        { partyId: { $in: partyMatches } },
      ],
    });
  } catch (e) {
    console.warn("[checkPartyHasTransactionsServer] Error checking orders:", e);
  }

  // 2. Purchase Bills
  try {
    const pbCol = await getCollection(COLLECTIONS.PURCHASE_BILLS);
    counts.purchaseBills = await pbCol.countDocuments({
      user_id: { $in: userMatches },
      $or: [
        { party_id: { $in: partyMatches } },
        { partyId: { $in: partyMatches } },
      ],
    });
  } catch (e) {
    console.warn("[checkPartyHasTransactionsServer] Error checking purchase bills:", e);
  }

  // 3. Sale Returns
  try {
    const srCol = await getCollection(COLLECTIONS.SALE_RETURN_TRANSACTIONS);
    counts.saleReturns = await srCol.countDocuments({
      user_id: { $in: userMatches },
      $or: [
        { customerId: { $in: partyMatches } },
        { customer_id: { $in: partyMatches } },
        { party_id: { $in: partyMatches } },
        { partyId: { $in: partyMatches } },
      ],
    });
  } catch (e) {
    console.warn("[checkPartyHasTransactionsServer] Error checking sale returns:", e);
  }

  // 4. Party Transactions (Payment In / Payment Out)
  try {
    const ptCol = await getCollection(COLLECTIONS.PARTY_TRANSACTIONS);
    counts.partyTransactions = await ptCol.countDocuments({
      user_id: { $in: userMatches },
      $or: [
        { customerId: { $in: partyMatches } },
        { customer_id: { $in: partyMatches } },
        { party_id: { $in: partyMatches } },
        { partyId: { $in: partyMatches } },
      ],
    });
  } catch (e) {
    console.warn("[checkPartyHasTransactionsServer] Error checking party transactions:", e);
  }

  // 5. Vendor Transactions
  try {
    const vtCol = await getCollection(COLLECTIONS.VENDOR_TRANSACTIONS);
    counts.vendorTransactions = await vtCol.countDocuments({
      user_id: { $in: userMatches },
      $or: [
        { vendor_id: { $in: partyMatches } },
        { vendorId: { $in: partyMatches } },
        { party_id: { $in: partyMatches } },
        { partyId: { $in: partyMatches } },
        { customer_id: { $in: partyMatches } },
        { customerId: { $in: partyMatches } },
      ],
    });
  } catch (e) {
    console.warn("[checkPartyHasTransactionsServer] Error checking vendor transactions:", e);
  }

  // 6. Party Ledger Entries (excluding pure opening balance)
  try {
    const pleCol = await getCollection(COLLECTIONS.PARTY_LEDGER_ENTRIES);
    counts.ledgerEntries = await pleCol.countDocuments({
      user_id: { $in: userMatches },
      $or: [
        { party_id: { $in: partyMatches } },
        { partyId: { $in: partyMatches } },
      ],
      event_type: { $nin: ["opening_balance", "opening"] },
    });
  } catch (e) {
    console.warn("[checkPartyHasTransactionsServer] Error checking party ledger entries:", e);
  }

  // 7. General Transactions
  try {
    const txCol = await getCollection(COLLECTIONS.TRANSACTIONS);
    counts.transactions = await txCol.countDocuments({
      user_id: { $in: userMatches },
      $or: [
        { customer_id: { $in: partyMatches } },
        { customerId: { $in: partyMatches } },
        { party_id: { $in: partyMatches } },
        { partyId: { $in: partyMatches } },
      ],
    });
  } catch (e) {
    console.warn("[checkPartyHasTransactionsServer] Error checking general transactions:", e);
  }

  // 8. Quotations
  try {
    const qCol = await getCollection(COLLECTIONS.QUOTATIONS);
    counts.quotations = await qCol.countDocuments({
      user_id: { $in: userMatches },
      $or: [
        { party_id: { $in: partyMatches } },
        { partyId: { $in: partyMatches } },
        { customer_id: { $in: partyMatches } },
        { customerId: { $in: partyMatches } },
      ],
    });
  } catch (e) {
    console.warn("[checkPartyHasTransactionsServer] Error checking quotations:", e);
  }

  const details: string[] = [];
  if (counts.orders > 0) details.push(`${counts.orders} Sales Invoice(s)`);
  if (counts.purchaseBills > 0) details.push(`${counts.purchaseBills} Purchase Bill(s)`);
  if (counts.saleReturns > 0) details.push(`${counts.saleReturns} Sale Return(s)`);
  if (counts.partyTransactions > 0) details.push(`${counts.partyTransactions} Payment(s)`);
  if (counts.vendorTransactions > 0) details.push(`${counts.vendorTransactions} Vendor Transaction(s)`);
  if (counts.ledgerEntries > 0) details.push(`${counts.ledgerEntries} Ledger Entry(s)`);
  if (counts.transactions > 0) details.push(`${counts.transactions} Transaction Record(s)`);
  if (counts.quotations > 0) details.push(`${counts.quotations} Quotation(s)`);

  const hasTransactions = details.length > 0;
  return {
    hasTransactions,
    counts,
    details,
    summary: details.join(", "),
  };
}

/**
 * Checks whether an item / product has any associated transactions in MongoDB across ALL collections.
 */
export async function checkProductHasTransactionsServer(options: {
  userId: string;
  productId: string;
}): Promise<ServerEntityTransactionCheckResult> {
  const { userId, productId } = options;
  const prodIdStr = String(productId).trim();
  const counts = {
    orders: 0,
    orderItems: 0,
    purchaseBills: 0,
    saleReturns: 0,
    partyTransactions: 0,
    vendorTransactions: 0,
    stockAdjustments: 0,
    inventoryBatches: 0,
    ledgerEntries: 0,
    transactions: 0,
    quotations: 0,
  };

  if (!prodIdStr) {
    return {
      hasTransactions: false,
      counts,
      details: [],
      summary: "",
    };
  }

  const userMatches: any[] = [userId];
  if (isValidObjectId(userId)) {
    userMatches.push(toObjectId(userId));
  }

  const prodMatches: any[] = [prodIdStr];
  if (isValidObjectId(prodIdStr)) {
    prodMatches.push(toObjectId(prodIdStr));
  }

  // 1. Orders / Sales Invoices
  try {
    const ordersCol = await getCollection(COLLECTIONS.ORDERS);
    counts.orders = await ordersCol.countDocuments({
      user_id: { $in: userMatches },
      $or: [
        { "items.product_id": { $in: prodMatches } },
        { "items.productId": { $in: prodMatches } },
        { "items.id": { $in: prodMatches } },
      ],
    });
  } catch (e) {
    console.warn("[checkProductHasTransactionsServer] Error checking orders:", e);
  }

  // 2. Order Items
  try {
    const orderItemsCol = await getCollection(COLLECTIONS.ORDER_ITEMS);
    counts.orderItems = await orderItemsCol.countDocuments({
      $or: [
        { product_id: { $in: prodMatches } },
        { productId: { $in: prodMatches } },
      ],
    });
  } catch (e) {
    console.warn("[checkProductHasTransactionsServer] Error checking order_items:", e);
  }

  // 3. Purchase Bills
  try {
    const pbCol = await getCollection(COLLECTIONS.PURCHASE_BILLS);
    counts.purchaseBills = await pbCol.countDocuments({
      user_id: { $in: userMatches },
      $or: [
        { "items.product_id": { $in: prodMatches } },
        { "items.productId": { $in: prodMatches } },
        { "items.id": { $in: prodMatches } },
      ],
    });
  } catch (e) {
    console.warn("[checkProductHasTransactionsServer] Error checking purchase bills:", e);
  }

  // 4. Sale Returns
  try {
    const srCol = await getCollection(COLLECTIONS.SALE_RETURN_TRANSACTIONS);
    counts.saleReturns = await srCol.countDocuments({
      user_id: { $in: userMatches },
      $or: [
        { "items.productId": { $in: prodMatches } },
        { "items.product_id": { $in: prodMatches } },
        { "items.id": { $in: prodMatches } },
      ],
    });
  } catch (e) {
    console.warn("[checkProductHasTransactionsServer] Error checking sale returns:", e);
  }

  // 5. Stock Adjustments
  try {
    const saCol = await getCollection(COLLECTIONS.STOCK_ADJUSTMENTS);
    counts.stockAdjustments = await saCol.countDocuments({
      user_id: { $in: userMatches },
      $or: [
        { product_id: { $in: prodMatches } },
        { productId: { $in: prodMatches } },
        { "items.product_id": { $in: prodMatches } },
        { "items.productId": { $in: prodMatches } },
      ],
    });
  } catch (e) {
    console.warn("[checkProductHasTransactionsServer] Error checking stock adjustments:", e);
  }

  // 6. Inventory Batches (Non-opening batches or consumed opening batches)
  try {
    const batchesCol = await getCollection(COLLECTIONS.INVENTORY_BATCHES);
    counts.inventoryBatches = await batchesCol.countDocuments({
      user_id: { $in: userMatches },
      $or: [
        { product_id: { $in: prodMatches } },
        { productId: { $in: prodMatches } },
      ],
      $and: [
        {
          $or: [
            { source_type: { $nin: ["opening_stock", "opening", null] } },
            { $expr: { $lt: ["$remaining_quantity", "$initial_quantity"] } },
          ],
        },
      ],
    });
  } catch (e) {
    console.warn("[checkProductHasTransactionsServer] Error checking inventory batches:", e);
  }

  // 7. Quotations
  try {
    const qCol = await getCollection(COLLECTIONS.QUOTATIONS);
    counts.quotations = await qCol.countDocuments({
      user_id: { $in: userMatches },
      $or: [
        { "items.productId": { $in: prodMatches } },
        { "items.product_id": { $in: prodMatches } },
        { "items.id": { $in: prodMatches } },
      ],
    });
  } catch (e) {
    console.warn("[checkProductHasTransactionsServer] Error checking quotations:", e);
  }

  const details: string[] = [];
  if (counts.orders > 0) details.push(`${counts.orders} Sales Invoice(s)`);
  if (counts.orderItems > 0 && counts.orders === 0) details.push(`${counts.orderItems} Order Item(s)`);
  if (counts.purchaseBills > 0) details.push(`${counts.purchaseBills} Purchase Bill(s)`);
  if (counts.saleReturns > 0) details.push(`${counts.saleReturns} Sale Return(s)`);
  if (counts.stockAdjustments > 0) details.push(`${counts.stockAdjustments} Stock Adjustment(s)`);
  if (counts.inventoryBatches > 0) details.push(`${counts.inventoryBatches} Inventory Batch(es)`);
  if (counts.quotations > 0) details.push(`${counts.quotations} Quotation(s)`);

  const hasTransactions = details.length > 0;
  return {
    hasTransactions,
    counts,
    details,
    summary: details.join(", "),
  };
}
