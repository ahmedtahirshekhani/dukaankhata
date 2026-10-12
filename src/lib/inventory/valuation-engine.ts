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
