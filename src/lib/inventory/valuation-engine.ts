import { getCollection, COLLECTIONS, toObjectId, isValidObjectId } from "@/lib/db/mongodb";
import { ValuationMethod } from "@/types/inventory";
import { calculateMovingAverage, roundToPrecision } from "@/lib/inventory/valuation-calc";

export { calculateMovingAverage, roundToPrecision };

/**
 * Gets the active stock valuation method configured for the shop/workspace.
 * Defaults to "average" (Weighted Average Cost).
 */
export async function getValuationMethod(userId: string): Promise<ValuationMethod> {
  try {
    const configCollection = await getCollection(COLLECTIONS.CONFIGURATIONS);
    const config = await configCollection.findOne({ user_id: toObjectId(userId) });
    const method = config?.stock_valuation_method;
    if (method === "fifo" || method === "average" || method === "static") {
      return method;
    }
  } catch (error) {
    console.error("Error reading valuation method config:", error);
  }
  return "average";
}

// Helper to check if product is goods (physical items, not services)
function isGoodsProduct(productDoc: any): boolean {
  const type = productDoc?.type;
  return !type || type === "goods" || type === "good";
}

/**
 * Processes incoming purchase bill items into inventory:
 * 1. Adjusts physical stock quantity.
 * 2. Updates product master cost_price (Weighted Average or latest FIFO rate).
 * 3. Records inward lot in `inventory_batches` collection.
 */
export async function applyPurchaseInwardServer(options: {
  userId: string;
  billId: string;
  billNumber: string;
  items: Array<{
    product_id: string | any;
    quantity: number;
    cost_price?: number;
    unit_price?: number;
    amount?: number;
  }>;
  billDate: Date;
}): Promise<void> {
  const { userId, billId, billNumber, items, billDate } = options;
  if (!items || !Array.isArray(items) || items.length === 0) return;

  const valuationMethod = await getValuationMethod(userId);
  const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
  const batchesCollection = await getCollection(COLLECTIONS.INVENTORY_BATCHES);

  for (const item of items) {
    if (!item.product_id) continue;
    const prodIdStr = item.product_id.toString();
    if (!isValidObjectId(prodIdStr)) continue;

    const product = await productsCollection.findOne({
      _id: toObjectId(prodIdStr),
      user_id: toObjectId(userId),
    });

    if (!product || !isGoodsProduct(product)) continue;

    const purchaseQty = Number(item.quantity) || 0;
    const purchaseCost = Number(item.cost_price ?? item.unit_price) || 0;
    if (purchaseQty <= 0) continue;

    const currentQty = parseFloat(product.quantity?.toString() || product.in_stock?.toString() || "0");
    const currentCost = parseFloat(product.cost_price?.toString() || product.purchase_price?.toString() || "0");
    const newQty = roundToPrecision(currentQty + purchaseQty, 5);

    const updateFields: any = {
      quantity: newQty,
      quantity_str: newQty.toString(),
      in_stock: newQty,
      updated_at: new Date(),
    };

    if (valuationMethod === "average") {
      // Calculate new moving average cost price
      const newAverageCost = calculateMovingAverage(currentQty, currentCost, purchaseQty, purchaseCost);
      updateFields.cost_price = newAverageCost;
      updateFields.cost_price_str = newAverageCost.toString();
      updateFields.purchase_price = newAverageCost;
    } else if (valuationMethod === "fifo") {
      // In FIFO mode, product master displays the latest purchase rate as reference
      updateFields.cost_price = purchaseCost;
      updateFields.cost_price_str = purchaseCost.toString();
      updateFields.purchase_price = purchaseCost;
    }
    // In "static" mode, cost_price is left as-is
    await productsCollection.updateOne(
      { _id: toObjectId(prodIdStr), user_id: toObjectId(userId) },
      { $set: updateFields }
    );

    // Record inventory batch lot for both FIFO queue and Average audit trail
    try {
      await batchesCollection.insertOne({
        user_id: toObjectId(userId),
        product_id: toObjectId(prodIdStr),
        source_type: "purchase_bill",
        source_id: billId.toString(),
        batch_number: billNumber || "PUR",
        initial_quantity: purchaseQty,
        remaining_quantity: purchaseQty,
        cost_price: purchaseCost,
        status: "active",
        batch_date: billDate,
        created_at: new Date(),
        updated_at: new Date(),
      });
    } catch (batchErr) {
      console.error("Failed to insert inventory batch:", batchErr);
    }
  }
}

/**
 * Reverses purchase inward items (when a bill is edited or deleted):
 * 1. Decrements physical stock quantity.
 * 2. Removes associated lots from `inventory_batches`.
 */
export async function reversePurchaseInwardServer(options: {
  userId: string;
  billId: string;
  items: Array<{
    product_id: string | any;
    quantity: number;
    cost_price?: number;
  }>;
}): Promise<void> {
  const { userId, billId, items } = options;
  if (!items || !Array.isArray(items) || items.length === 0) return;

  const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
  const batchesCollection = await getCollection(COLLECTIONS.INVENTORY_BATCHES);

  // 1. Remove batches created by this purchase bill
  try {
    await batchesCollection.deleteMany({
      user_id: toObjectId(userId),
      source_id: billId.toString(),
    });
  } catch (delBatchErr) {
    console.error("Failed to delete inventory batches for bill:", delBatchErr);
  }

  // 2. Deduct quantities from products
  for (const item of items) {
    if (!item.product_id) continue;
    const prodIdStr = item.product_id.toString();
    if (!isValidObjectId(prodIdStr)) continue;

    const product = await productsCollection.findOne({
      _id: toObjectId(prodIdStr),
      user_id: toObjectId(userId),
    });

    if (!product || !isGoodsProduct(product)) continue;

    const reverseQty = Number(item.quantity) || 0;
    if (reverseQty <= 0) continue;

    const currentQty = parseFloat(product.quantity?.toString() || product.in_stock?.toString() || "0");
    const newQty = roundToPrecision(currentQty - reverseQty, 5);

    const updateFields: any = {
      quantity: newQty,
      quantity_str: newQty.toString(),
      in_stock: newQty,
      updated_at: new Date(),
    };

    // Re-evaluate cost price from remaining active batches
    const remainingBatches = await batchesCollection
      .find({
        user_id: toObjectId(userId),
        product_id: toObjectId(prodIdStr),
        status: "active",
      })
      .sort({ batch_date: -1 })
      .toArray();

    const valuationMethod = await getValuationMethod(userId);

    if (remainingBatches.length > 0) {
      if (valuationMethod === "fifo") {
        const latestBatchCost = Number(remainingBatches[0].cost_price) || 0;
        updateFields.cost_price = latestBatchCost;
        updateFields.cost_price_str = latestBatchCost.toString();
        updateFields.purchase_price = latestBatchCost;
      } else if (valuationMethod === "average") {
        let totalVal = 0;
        let totalRemQty = 0;
        for (const b of remainingBatches) {
          const bQty = Number(b.remaining_quantity ?? b.initial_quantity) || 0;
          totalVal += bQty * Number(b.cost_price || 0);
          totalRemQty += bQty;
        }
        if (totalRemQty > 0) {
          const restoredAverage = roundToPrecision(totalVal / totalRemQty, 4);
          updateFields.cost_price = restoredAverage;
          updateFields.cost_price_str = restoredAverage.toString();
          updateFields.purchase_price = restoredAverage;
        }
      }
    }

    await productsCollection.updateOne(
      { _id: toObjectId(prodIdStr), user_id: toObjectId(userId) },
      { $set: updateFields }
    );
  }
}

/**
 * Consumes stock from active lots using FIFO (First-In, First-Out) rule:
 * 1. Queries active lots sorted by batch_date and created_at ascending.
 * 2. Consumes quantities lot-by-lot until saleQty is met.
 * 3. Returns split details, total COGS, and effective unit cost.
 */
export async function consumeBatchesOnSaleServer(options: {
  userId: string;
  productId: string;
  saleQty: number;
  orderId?: string;
  fallbackCostPrice?: number;
}): Promise<{
  consumed_batches: Array<{
    batch_id: any;
    batch_number?: string;
    quantity: number;
    cost_price: number;
    total_cost: number;
  }>;
  total_cogs: number;
  remaining_unfulfilled_qty: number;
  effective_unit_cost: number;
}> {
  const { userId, productId, saleQty, fallbackCostPrice = 0 } = options;
  const batchesCollection = await getCollection(COLLECTIONS.INVENTORY_BATCHES);

  if (saleQty <= 0) {
    return {
      consumed_batches: [],
      total_cogs: 0,
      remaining_unfulfilled_qty: 0,
      effective_unit_cost: fallbackCostPrice,
    };
  }

  // Find active batches for this product, sorted FIFO (earliest batch_date first)
  const activeBatches = await batchesCollection
    .find({
      user_id: toObjectId(userId),
      product_id: toObjectId(productId),
      status: "active",
      remaining_quantity: { $gt: 0 },
    })
    .sort({ batch_date: 1, created_at: 1 })
    .toArray();

  let unfulfilledQty = saleQty;
  let totalCogs = 0;
  const consumedBatches: Array<{
    batch_id: any;
    batch_number?: string;
    quantity: number;
    cost_price: number;
    total_cost: number;
  }> = [];

  for (const batch of activeBatches) {
    if (unfulfilledQty <= 0) break;

    const available = Number(batch.remaining_quantity) || 0;
    if (available <= 0) continue;

    const takeQty = Math.min(available, unfulfilledQty);
    const newRemaining = roundToPrecision(available - takeQty, 5);
    const costPrice = Number(batch.cost_price) || 0;
    const splitCost = roundToPrecision(takeQty * costPrice, 2);

    consumedBatches.push({
      batch_id: batch._id ? toObjectId(batch._id) : batch._id,
      batch_number: batch.batch_number || "BATCH",
      quantity: takeQty,
      cost_price: costPrice,
      total_cost: splitCost,
    });

    totalCogs += splitCost;
    unfulfilledQty = roundToPrecision(unfulfilledQty - takeQty, 5);

    await batchesCollection.updateOne(
      { _id: batch._id },
      {
        $set: {
          remaining_quantity: newRemaining,
          status: newRemaining <= 0 ? "depleted" : "active",
          updated_at: new Date(),
        },
      }
    );
  }

  // If sale quantity exceeded available batches (e.g. overselling), use fallback cost
  if (unfulfilledQty > 0) {
    const unfulfilledCost = roundToPrecision(unfulfilledQty * fallbackCostPrice, 2);
    totalCogs += unfulfilledCost;
  }

  const effectiveUnitCost = saleQty > 0 ? roundToPrecision(totalCogs / saleQty, 2) : fallbackCostPrice;

  return {
    consumed_batches: consumedBatches,
    total_cogs: roundToPrecision(totalCogs, 2),
    remaining_unfulfilled_qty: unfulfilledQty,
    effective_unit_cost: effectiveUnitCost,
  };
}

/**
 * Restores consumed quantities back to their original batches (when order is edited or cancelled).
 */
export async function restoreBatchesOnSaleRevertServer(options: {
  userId: string;
  consumedBatches: Array<{
    batch_id: string;
    quantity: number;
  }>;
}): Promise<void> {
  const { userId, consumedBatches } = options;
  if (!consumedBatches || !Array.isArray(consumedBatches) || consumedBatches.length === 0) return;

  const batchesCollection = await getCollection(COLLECTIONS.INVENTORY_BATCHES);

  for (const split of consumedBatches) {
    if (!split.batch_id || !isValidObjectId(split.batch_id)) continue;
    const returnQty = Number(split.quantity) || 0;
    if (returnQty <= 0) continue;

    const batch = await batchesCollection.findOne({
      _id: toObjectId(split.batch_id),
      user_id: toObjectId(userId),
    });

    if (batch) {
      const curRemaining = Number(batch.remaining_quantity) || 0;
      const newRemaining = roundToPrecision(curRemaining + returnQty, 5);
      await batchesCollection.updateOne(
        { _id: batch._id },
        {
          $set: {
            remaining_quantity: newRemaining,
            status: "active",
            updated_at: new Date(),
          },
        }
      );
    }
  }
}

/**
 * Re-inwards returned goods into the inventory batches queue at the original purchase cost.
 */
export async function reInwardBatchOnSaleReturnServer(options: {
  userId: string;
  returnId: string;
  returnNumber: string;
  productId: string;
  quantity: number;
  costPrice: number;
  returnDate: Date;
}): Promise<void> {
  const { userId, returnId, returnNumber, productId, quantity, costPrice, returnDate } = options;
  if (!productId || !isValidObjectId(productId) || quantity <= 0) return;

  const batchesCollection = await getCollection(COLLECTIONS.INVENTORY_BATCHES);

  try {
    await batchesCollection.insertOne({
      user_id: toObjectId(userId),
      product_id: toObjectId(productId),
      source_type: "sale_return",
      source_id: returnId.toString(),
      batch_number: `RET-${returnNumber || "SR"}`,
      initial_quantity: quantity,
      remaining_quantity: quantity,
      cost_price: costPrice,
      status: "active",
      batch_date: returnDate,
      created_at: new Date(),
      updated_at: new Date(),
    });
  } catch (err) {
    console.error("Failed to insert inventory batch on sale return:", err);
  }
}
