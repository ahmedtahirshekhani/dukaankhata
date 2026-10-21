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

    let computedAverageCost = purchaseCost;
    if (valuationMethod === "average") {
      // Calculate new moving average cost price
      const newAverageCost = calculateMovingAverage(currentQty, currentCost, purchaseQty, purchaseCost);
      computedAverageCost = newAverageCost;
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

      // Auto-reconcile past unfulfilled/oversold sales in chronological order (Vyapar style)
      if (valuationMethod === "fifo") {
        await reconcileUnfulfilledSalesForProduct({
          userId,
          productId: prodIdStr,
        });
      } else if (valuationMethod === "average") {
        await reconcileUnfulfilledSalesForProductAverage({
          userId,
          productId: prodIdStr,
          costPrice: computedAverageCost,
        });
      }
    } catch (batchErr) {
      console.error("Failed to insert inventory batch:", batchErr);
    }
  }
}

/**
 * Auto-reconciles unfulfilled / oversold past sales in chronological FIFO order
 * whenever a new purchase batch arrives or stock is replenished.
 */
export async function reconcileUnfulfilledSalesForProduct(options: {
  userId: string;
  productId: string;
}): Promise<{
  reconciledOrdersCount: number;
  unitsReconciled: number;
}> {
  const { userId, productId } = options;
  if (!productId || !isValidObjectId(productId)) {
    return { reconciledOrdersCount: 0, unitsReconciled: 0 };
  }

  const valuationMethod = await getValuationMethod(userId);
  if (valuationMethod !== "fifo") {
    return { reconciledOrdersCount: 0, unitsReconciled: 0 };
  }

  const uId = toObjectId(userId);
  const pId = toObjectId(productId);

  const batchesCollection = await getCollection(COLLECTIONS.INVENTORY_BATCHES);
  const ordersCollection = await getCollection(COLLECTIONS.ORDERS);
  const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);

  const product = await productsCollection.findOne({ _id: pId, user_id: uId });
  const fallbackCost = Number(product?.cost_price ?? product?.purchase_price) || 0;

  // Find candidate orders containing this product sorted chronologically (earliest sale first)
  const candidateOrders = await ordersCollection
    .find({
      user_id: uId,
      status: { $ne: "cancelled" },
      "items.product_id": { $in: [pId, productId] },
    })
    .sort({ sale_date: 1, created_at: 1 })
    .toArray();

  let reconciledOrdersCount = 0;
  let totalUnitsReconciled = 0;

  for (const order of candidateOrders) {
    let orderModified = false;
    const items = order.items || [];

    for (const item of items) {
      const itProdId = item.product_id?.toString();
      if (itProdId !== productId && itProdId !== pId.toString()) continue;

      const itemQty = Number(item.quantity) || 0;
      if (itemQty <= 0) continue;

      const currentSplits = Array.isArray(item.batch_splits) ? [...item.batch_splits] : [];
      const fulfilledQty = currentSplits.reduce((acc: number, sp: any) => acc + (Number(sp.quantity) || 0), 0);
      let deficitQty = Math.max(0, roundToPrecision(itemQty - fulfilledQty, 5));

      // Check if item was marked as having unfulfilled quantity
      if (deficitQty <= 0) {
        if (item.unfulfilled_quantity !== 0 || item.is_oversold !== false) {
          item.unfulfilled_quantity = 0;
          item.is_oversold = false;
          orderModified = true;
        }
        continue;
      }

      // Find active batches for this product
      const activeBatches = await batchesCollection
        .find({
          user_id: uId,
          product_id: pId,
          status: "active",
          remaining_quantity: { $gt: 0 },
        })
        .sort({ batch_date: 1, created_at: 1 })
        .toArray();

      if (activeBatches.length === 0) {
        continue;
      }

      let unitsFulfilledForThisItem = 0;

      for (const batch of activeBatches) {
        if (deficitQty <= 0) break;
        const available = Number(batch.remaining_quantity) || 0;
        if (available <= 0) continue;

        const takeQty = Math.min(available, deficitQty);
        const newRemaining = roundToPrecision(available - takeQty, 5);
        const bCost = Number(batch.cost_price) || 0;
        const splitCost = roundToPrecision(takeQty * bCost, 2);

        // Update batch remaining quantity
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

        // Append to item's batch splits
        currentSplits.push({
          batch_id: batch._id ? toObjectId(batch._id) : batch._id,
          batch_number: batch.batch_number || "BATCH",
          quantity: takeQty,
          cost_price: bCost,
          total_cost: splitCost,
          reconciled_at: new Date(),
        });

        deficitQty = roundToPrecision(deficitQty - takeQty, 5);
        unitsFulfilledForThisItem += takeQty;
        totalUnitsReconciled += takeQty;
      }

      if (unitsFulfilledForThisItem > 0) {
        item.batch_splits = currentSplits;
        item.unfulfilled_quantity = deficitQty;
        item.is_oversold = deficitQty > 0;

        // Recalculate total_cogs
        const splitsCostTotal = currentSplits.reduce((acc: number, sp: any) => acc + (Number(sp.total_cost) || 0), 0);
        const unfulfilledFallback = roundToPrecision(deficitQty * fallbackCost, 2);
        const newTotalCogs = roundToPrecision(splitsCostTotal + unfulfilledFallback, 2);

        item.total_cogs = newTotalCogs;
        item.cost_price = itemQty > 0 ? roundToPrecision(newTotalCogs / itemQty, 2) : fallbackCost;

        orderModified = true;
      }
    }

    if (orderModified) {
      await ordersCollection.updateOne(
        { _id: order._id },
        {
          $set: {
            items,
            updated_at: new Date(),
          },
        }
      );
      reconciledOrdersCount++;
    }
  }

  return {
    reconciledOrdersCount,
    unitsReconciled: totalUnitsReconciled,
  };
}

/**
 * Auto-reconciles unfulfilled / oversold or zero-cost past sales in Average Costing mode
 * whenever a new purchase arrives or stock is replenished.
 */
export async function reconcileUnfulfilledSalesForProductAverage(options: {
  userId: string;
  productId: string;
  costPrice: number;
}): Promise<{
  reconciledOrdersCount: number;
}> {
  const { userId, productId, costPrice } = options;
  if (!productId || !isValidObjectId(productId) || costPrice <= 0) {
    return { reconciledOrdersCount: 0 };
  }

  const uId = toObjectId(userId);
  const pId = toObjectId(productId);
  const ordersCollection = await getCollection(COLLECTIONS.ORDERS);

  const candidateOrders = await ordersCollection
    .find({
      user_id: uId,
      status: { $ne: "cancelled" },
      "items.product_id": { $in: [pId, productId] },
    })
    .sort({ sale_date: 1, created_at: 1 })
    .toArray();

  let reconciledOrdersCount = 0;

  for (const order of candidateOrders) {
    let orderModified = false;
    const items = order.items || [];

    for (const item of items) {
      const itProdId = item.product_id?.toString();
      if (itProdId !== productId && itProdId !== pId.toString()) continue;

      const itemQty = Number(item.quantity) || 0;
      if (itemQty <= 0) continue;

      const currentCost = Number(item.cost_price) || 0;
      const currentCogs = Number(item.total_cogs) || 0;
      const isOversold = item.is_oversold === true || Number(item.unfulfilled_quantity) > 0;

      const unfulfilledQty = Number(item.unfulfilled_quantity) || 0;

      if (currentCost <= 0 || currentCogs <= 0) {
        // If item was sold with 0 cost (no cost existed or was 0), entire quantity takes the replenishment cost
        item.cost_price = costPrice;
        item.total_cogs = roundToPrecision(itemQty * costPrice, 2);
        item.unfulfilled_quantity = 0;
        item.is_oversold = false;
        orderModified = true;
      } else if (isOversold && unfulfilledQty > 0) {
        // Item had some stock when sold, but part of it was deficit/unfulfilled.
        // Only the unfulfilled deficit takes the new replenishment cost; previously fulfilled stock keeps its original cost.
        const fulfilledQty = Math.max(0, itemQty - unfulfilledQty);
        const originalCost = currentCost > 0 ? currentCost : costPrice;
        const fulfilledCogs = roundToPrecision(fulfilledQty * originalCost, 2);
        const deficitCogs = roundToPrecision(unfulfilledQty * costPrice, 2);
        const newTotalCogs = roundToPrecision(fulfilledCogs + deficitCogs, 2);
        const effectiveUnitCost = roundToPrecision(newTotalCogs / itemQty, 2);

        item.cost_price = effectiveUnitCost;
        item.total_cogs = newTotalCogs;
        item.unfulfilled_quantity = 0;
        item.is_oversold = false;
        orderModified = true;
      } else if (isOversold) {
        item.unfulfilled_quantity = 0;
        item.is_oversold = false;
        orderModified = true;
      }
    }

    if (orderModified) {
      await ordersCollection.updateOne(
        { _id: order._id },
        {
          $set: {
            items,
            updated_at: new Date(),
          },
        }
      );
      reconciledOrdersCount++;
    }
  }

  return { reconciledOrdersCount };
}

/**
 * Reverses purchase inward items (when a bill is edited or deleted):
 * 1. Decrements physical stock quantity.
 * 2. Unlinks batches from reconciled orders and restores unfulfilled deficits.
 * 3. Removes associated lots from `inventory_batches`.
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
  const ordersCollection = await getCollection(COLLECTIONS.ORDERS);

  // 1. Find batches created by this purchase bill
  try {
    const billBatches = await batchesCollection
      .find({
        user_id: toObjectId(userId),
        source_id: billId.toString(),
      })
      .toArray();

    const billBatchIdStrs = new Set(billBatches.map(b => b._id.toString()));

    if (billBatchIdStrs.size > 0) {
      // Find orders that had batch splits referencing these batches
      const affectedOrders = await ordersCollection
        .find({
          user_id: toObjectId(userId),
          status: { $ne: "cancelled" },
          "items.batch_splits.batch_id": { $in: billBatches.map(b => b._id) },
        })
        .toArray();

      for (const ord of affectedOrders) {
        let ordModified = false;
        for (const it of (ord.items || [])) {
          if (!Array.isArray(it.batch_splits)) continue;
          const matchingSplits = it.batch_splits.filter((sp: any) => billBatchIdStrs.has(sp.batch_id?.toString()));
          if (matchingSplits.length > 0) {
            const removedQty = matchingSplits.reduce((acc: number, sp: any) => acc + (Number(sp.quantity) || 0), 0);
            it.batch_splits = it.batch_splits.filter((sp: any) => !billBatchIdStrs.has(sp.batch_id?.toString()));
            it.unfulfilled_quantity = roundToPrecision((Number(it.unfulfilled_quantity) || 0) + removedQty, 5);
            it.is_oversold = true;

            const remainingSplitsCost = it.batch_splits.reduce((acc: number, sp: any) => acc + (Number(sp.total_cost) || 0), 0);
            const fallback = Number(it.cost_price) || 0;
            it.total_cogs = roundToPrecision(remainingSplitsCost + (it.unfulfilled_quantity * fallback), 2);
            ordModified = true;
          }
        }
        if (ordModified) {
          await ordersCollection.updateOne(
            { _id: ord._id },
            { $set: { items: ord.items, updated_at: new Date() } }
          );
        }
      }
    }

    // Remove batches created by this purchase bill
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

    const valuationMethod = await getValuationMethod(userId);
    if (valuationMethod === "fifo") {
      await reconcileUnfulfilledSalesForProduct({
        userId,
        productId,
      });
    } else if (valuationMethod === "average") {
      const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
      const product = await productsCollection.findOne({ _id: toObjectId(productId), user_id: toObjectId(userId) });
      let finalAvgCost = costPrice;
      if (product) {
        const curQty = parseFloat(product.quantity?.toString() || product.in_stock?.toString() || "0");
        const prevQty = Math.max(0, curQty - quantity);
        const curCost = parseFloat(product.cost_price?.toString() || product.purchase_price?.toString() || "0");
        if (prevQty > 0 && curCost > 0 && costPrice > 0) {
          finalAvgCost = calculateMovingAverage(prevQty, curCost, quantity, costPrice);
        } else if (costPrice > 0) {
          finalAvgCost = costPrice;
        } else {
          finalAvgCost = curCost;
        }
        await productsCollection.updateOne(
          { _id: toObjectId(productId), user_id: toObjectId(userId) },
          {
            $set: {
              cost_price: finalAvgCost,
              cost_price_str: finalAvgCost.toString(),
              purchase_price: finalAvgCost,
              updated_at: new Date(),
            }
          }
        );
      }
      if (finalAvgCost > 0) {
        await reconcileUnfulfilledSalesForProductAverage({
          userId,
          productId,
          costPrice: finalAvgCost,
        });
      }
    }
  } catch (err) {
    console.error("Failed to insert inventory batch on sale return:", err);
  }
}
