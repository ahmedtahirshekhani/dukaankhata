import { getCollection, COLLECTIONS, toObjectId, isValidObjectId } from "@/lib/db/mongodb";
import { ValuationMethod } from "@/types/inventory";
import { calculateMovingAverage, calculateMovingAverageWithPrior, roundToPrecision } from "@/lib/inventory/valuation-calc";

export { calculateMovingAverage, calculateMovingAverageWithPrior, roundToPrecision };

/**
 * Finds how many units of previous stock were fulfilled in oversold orders on server MongoDB.
 * Used when stock is negative and a replenishment purchase/adjustment arrives.
 */
export async function getServerPriorFulfilledQty(userId: string, prodIdStr: string): Promise<number> {
  try {
    const ordersCollection = await getCollection(COLLECTIONS.ORDERS);
    const candidateOrders = await ordersCollection.find({
      user_id: toObjectId(userId),
      status: { $ne: "cancelled" },
      "items.product_id": { $in: [toObjectId(prodIdStr), prodIdStr] },
    }).toArray();

    let priorFulfilled = 0;
    for (const order of candidateOrders) {
      for (const item of (order.items || [])) {
        const itProdId = item.product_id?.toString();
        if (itProdId === prodIdStr) {
          const itQty = Number(item.quantity) || 0;
          const unfulfilled = Number(item.unfulfilled_quantity) || 0;
          priorFulfilled += Math.max(0, itQty - unfulfilled);
        }
      }
    }
    return priorFulfilled;
  } catch (err) {
    console.error("Error computing prior fulfilled qty server:", err);
    return 0;
  }
}

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
      let priorFulfilledQty = 0;
      if (currentQty < 0) {
        priorFulfilledQty = await getServerPriorFulfilledQty(userId, prodIdStr);
      }
      const newAverageCost = calculateMovingAverageWithPrior(currentQty, currentCost, purchaseQty, purchaseCost, priorFulfilledQty);
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
          inwardQty: purchaseQty,
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
  inwardQty?: number;
}): Promise<{
  reconciledOrdersCount: number;
}> {
  const { userId, productId, costPrice, inwardQty = 0 } = options;
  if (!productId || !isValidObjectId(productId) || costPrice <= 0) {
    return { reconciledOrdersCount: 0 };
  }

  const uId = toObjectId(userId);
  const pId = toObjectId(productId);
  const ordersCollection = await getCollection(COLLECTIONS.ORDERS);
  const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
  const batchesCollection = await getCollection(COLLECTIONS.INVENTORY_BATCHES);

  const product = await productsCollection.findOne({ _id: pId, user_id: uId });
  const curStock = parseFloat(product?.quantity?.toString() || product?.in_stock?.toString() || "0");

  const candidateOrders = await ordersCollection
    .find({
      user_id: uId,
      status: { $ne: "cancelled" },
      "items.product_id": { $in: [pId, productId] },
    })
    .sort({ sale_date: 1, created_at: 1 })
    .toArray();

  const totalSold = candidateOrders.reduce((acc: number, ord: any) => {
    const match = (ord.items || []).find((it: any) => {
      const itId = it.product_id?.toString();
      return itId === productId || itId === pId.toString();
    });
    return acc + (Number(match?.quantity) || 0);
  }, 0);

  const batches = await batchesCollection.find({ user_id: uId, product_id: pId }).toArray();
  const initialBatchQty = batches.reduce((acc: number, b: any) => acc + (Number(b.initial_quantity) || 0), 0);
  const totalHistoricalAcquired = Math.max(initialBatchQty, curStock + totalSold);

  let runningFulfilledBudget = roundToPrecision(totalHistoricalAcquired - (Number(inwardQty) || 0), 5);
  let remainingInward = Number(inwardQty) > 0 ? Number(inwardQty) : 0;
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

      let unfulfilled = Number(item.unfulfilled_quantity) || 0;
      if (item.is_oversold && unfulfilled <= 0) {
        unfulfilled = itemQty;
      }

      // Self-heal: if unfulfilled was prematurely cleared by earlier bug but running budget shows deficit
      if (unfulfilled <= 0 && !item.is_oversold && runningFulfilledBudget < itemQty) {
        const priorCovered = Math.max(0, runningFulfilledBudget);
        unfulfilled = roundToPrecision(itemQty - priorCovered, 5);
        item.is_oversold = unfulfilled > 0;
      }
      runningFulfilledBudget = Math.max(0, roundToPrecision(runningFulfilledBudget - itemQty, 5));

      if (unfulfilled > 0) {
        if (remainingInward > 0) {
          const takeQty = Math.min(remainingInward, unfulfilled);
          unfulfilled = roundToPrecision(unfulfilled - takeQty, 5);
          remainingInward = roundToPrecision(remainingInward - takeQty, 5);

          item.unfulfilled_quantity = unfulfilled;
          item.is_oversold = unfulfilled > 0;
          item.cost_price = costPrice;
          item.total_cogs = roundToPrecision(itemQty * costPrice, 2);
          orderModified = true;
        } else {
          // Not enough inward units from this batch; remains oversold
          item.unfulfilled_quantity = unfulfilled;
          item.is_oversold = true;
          // In average costing, the invoice's cost price still reflects the latest known average
          item.cost_price = costPrice;
          item.total_cogs = roundToPrecision(itemQty * costPrice, 2);
          orderModified = true;
        }
      } else if (currentCost <= 0 || currentCogs <= 0) {
        item.cost_price = costPrice;
        item.total_cogs = roundToPrecision(itemQty * costPrice, 2);
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
    unit_price?: number;
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

    if (valuationMethod === "fifo") {
      if (remainingBatches.length > 0) {
        const latestBatchCost = Number(remainingBatches[0].cost_price) || 0;
        updateFields.cost_price = latestBatchCost;
        updateFields.cost_price_str = latestBatchCost.toString();
        updateFields.purchase_price = latestBatchCost;
      }
    } else if (valuationMethod === "average") {
      const currentCost = parseFloat(product.cost_price?.toString() || product.purchase_price?.toString() || "0");
      let itemCost = Number(item.cost_price ?? (item as any).purchase_price ?? item.unit_price ?? (item as any).price ?? (item as any).sell_price ?? 0);
      if (itemCost <= 0) {
        itemCost = currentCost;
      }

      const prevQty = newQty;
      const prevTotalVal = (currentQty * currentCost) - (reverseQty * itemCost);

      if (prevQty > 0) {
        const restoredAverage = prevTotalVal > 0 ? roundToPrecision(prevTotalVal / prevQty, 2) : currentCost;
        updateFields.cost_price = restoredAverage;
        updateFields.cost_price_str = restoredAverage.toString();
        updateFields.purchase_price = restoredAverage;
      } else if (remainingBatches.length > 0) {
        let totalVal = 0;
        let totalRemQty = 0;
        for (const b of remainingBatches) {
          const bQty = Number(b.remaining_quantity ?? b.initial_quantity) || 0;
          totalVal += bQty * Number(b.cost_price || 0);
          totalRemQty += bQty;
        }
        if (totalRemQty > 0) {
          const restoredAverage = roundToPrecision(totalVal / totalRemQty, 2);
          updateFields.cost_price = restoredAverage;
          updateFields.cost_price_str = restoredAverage.toString();
          updateFields.purchase_price = restoredAverage;
        }
      } else {
        updateFields.cost_price = currentCost;
        updateFields.cost_price_str = currentCost.toString();
        updateFields.purchase_price = currentCost;
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
          inwardQty: quantity,
        });
      }
    }
  } catch (err) {
    console.error("Failed to insert inventory batch on sale return:", err);
  }
}

/**
 * Fully re-sequences and re-consumes FIFO batches for a single product across its entire timeline.
 * Called whenever an adjustment, purchase, or sale is created, edited (date/qty change), or deleted.
 * Guarantees that batch tracking is dynamic, batches match chronological sales, and remaining quantities are accurate.
 */
export async function resequenceProductFIFOBatchesServer(options: {
  userId: string;
  productId: string;
}): Promise<{ success: boolean; resequencedBatchesCount: number; resequencedOrdersCount: number }> {
  const { userId, productId } = options;
  if (!productId || !isValidObjectId(productId)) {
    return { success: false, resequencedBatchesCount: 0, resequencedOrdersCount: 0 };
  }

  const valuationMethod = await getValuationMethod(userId);
  if (valuationMethod !== "fifo") {
    return { success: true, resequencedBatchesCount: 0, resequencedOrdersCount: 0 };
  }

  const uId = toObjectId(userId);
  const pId = toObjectId(productId);

  const batchesCollection = await getCollection(COLLECTIONS.INVENTORY_BATCHES);
  const ordersCollection = await getCollection(COLLECTIONS.ORDERS);
  const stockAdjustmentsCollection = await getCollection(COLLECTIONS.STOCK_ADJUSTMENTS);
  const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);

  const product = await productsCollection.findOne({ _id: pId, user_id: uId });
  if (!product) {
    return { success: false, resequencedBatchesCount: 0, resequencedOrdersCount: 0 };
  }
  const fallbackCost = Number(product.cost_price ?? product.purchase_price) || 0;

  // 1. Fetch all inward batches for this product, ordered chronologically (oldest first)
  const batches = await batchesCollection
    .find({
      user_id: uId,
      product_id: pId,
      is_delete: { $ne: true },
    })
    .sort({ batch_date: 1, created_at: 1 })
    .toArray();

  if (batches.length === 0) {
    return { success: true, resequencedBatchesCount: 0, resequencedOrdersCount: 0 };
  }

  // Reset in-memory batch state
  for (const b of batches) {
    b.remaining_quantity = Number(b.initial_quantity) || 0;
  }

  // 2. Fetch all outward candidate transactions (Sales and Stock Adjustments Reduce)
  const orders = await ordersCollection
    .find({
      user_id: uId,
      status: { $ne: "cancelled" },
      "items.product_id": { $in: [pId, productId] },
    })
    .toArray();

  const adjustments = await stockAdjustmentsCollection
    .find({
      user_id: uId,
      product_id: pId,
      action_type: "reduce",
      stock_type: "available",
      is_delete: { $ne: true },
    })
    .toArray();

  // 3. Build a unified chronologically ordered list of outward events
  type OutwardEvent = {
    type: "order" | "adjustment";
    id: any;
    date: Date;
    createdAt: Date;
    quantity: number;
    doc: any;
    itemIndex?: number;
  };

  const outwardEvents: OutwardEvent[] = [];

  for (const order of orders) {
    const orderDate = new Date(order.sale_date || order.date || order.created_at || 0);
    const orderCreatedAt = new Date(order.created_at || orderDate);
    (order.items || []).forEach((it: any, idx: number) => {
      const itProdId = it.product_id?.toString() || it.productId?.toString();
      if (itProdId === productId || itProdId === pId.toString()) {
        const qty = Number(it.quantity) || 0;
        if (qty > 0) {
          outwardEvents.push({
            type: "order",
            id: order._id,
            date: orderDate,
            createdAt: orderCreatedAt,
            quantity: qty,
            doc: order,
            itemIndex: idx,
          });
        }
      }
    });
  }

  for (const adj of adjustments) {
    const adjDate = new Date(adj.date || adj.adjustment_date || adj.created_at || 0);
    const adjCreatedAt = new Date(adj.created_at || adjDate);
    const qty = Number(adj.quantity) || 0;
    if (qty > 0) {
      outwardEvents.push({
        type: "adjustment",
        id: adj._id,
        date: adjDate,
        createdAt: adjCreatedAt,
        quantity: qty,
        doc: adj,
      });
    }
  }

  // Sort chronologically (oldest sale/reduction first)
  outwardEvents.sort((a, b) => {
    const da = a.date.getTime();
    const db = b.date.getTime();
    if (da !== db) return da - db;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const modifiedOrders = new Map<string, any>();
  const modifiedAdjustments = new Map<string, any>();

  // 4. Sequentially consume batches for each outward event
  for (const event of outwardEvents) {
    let neededQty = event.quantity;
    const splits: any[] = [];

    for (const batch of batches) {
      if (neededQty <= 0) break;
      const available = Number(batch.remaining_quantity) || 0;
      if (available <= 0) continue;

      const take = Math.min(available, neededQty);
      const bCost = Number(batch.cost_price) || 0;
      const splitTotal = roundToPrecision(take * bCost, 2);

      batch.remaining_quantity = roundToPrecision(available - take, 5);
      neededQty = roundToPrecision(neededQty - take, 5);

      splits.push({
        batch_id: batch._id ? toObjectId(batch._id) : batch._id,
        batch_number: batch.batch_number || "BATCH",
        quantity: take,
        cost_price: bCost,
        total_cost: splitTotal,
        reconciled_at: new Date(),
      });
    }

    if (event.type === "order") {
      const order = event.doc;
      const it = order.items[event.itemIndex!];
      it.batch_splits = splits;
      it.unfulfilled_quantity = neededQty;
      it.is_oversold = neededQty > 0;

      const splitsCostTotal = splits.reduce((acc: number, sp: any) => acc + (Number(sp.total_cost) || 0), 0);
      const unfulfilledFallback = roundToPrecision(neededQty * fallbackCost, 2);
      const newTotalCogs = roundToPrecision(splitsCostTotal + unfulfilledFallback, 2);
      it.total_cogs = newTotalCogs;
      it.cost_price = event.quantity > 0 ? roundToPrecision(newTotalCogs / event.quantity, 2) : fallbackCost;

      modifiedOrders.set(order._id.toString(), order);
    } else if (event.type === "adjustment") {
      const adj = event.doc;
      adj.batch_splits = splits;
      modifiedAdjustments.set(adj._id.toString(), adj);
    }
  }

  // 5. Commit batch updates in DB
  for (const batch of batches) {
    const finalRem = Number(batch.remaining_quantity) || 0;
    await batchesCollection.updateOne(
      { _id: batch._id },
      {
        $set: {
          remaining_quantity: finalRem,
          status: finalRem <= 0 ? "depleted" : "active",
          updated_at: new Date(),
        },
      }
    );
  }

  // 6. Commit modified orders
  for (const order of Array.from(modifiedOrders.values())) {
    await ordersCollection.updateOne(
      { _id: order._id },
      {
        $set: {
          items: order.items,
          updated_at: new Date(),
        },
      }
    );
  }

  // 7. Commit modified adjustments
  for (const adj of Array.from(modifiedAdjustments.values())) {
    await stockAdjustmentsCollection.updateOne(
      { _id: adj._id },
      {
        $set: {
          batch_splits: adj.batch_splits,
          updated_at: new Date(),
        },
      }
    );
  }

  // 8. Update product's cost_price to the oldest unexhausted active batch (standard FIFO)
  const activeBatch = batches.find((b: any) => Number(b.remaining_quantity) > 0);
  if (activeBatch && Number(activeBatch.cost_price) > 0) {
    const fifoCost = Number(activeBatch.cost_price);
    await productsCollection.updateOne(
      { _id: pId },
      {
        $set: {
          cost_price: fifoCost,
          cost_price_str: fifoCost.toString(),
          purchase_price: fifoCost,
          updated_at: new Date(),
        },
      }
    );
  }

  return {
    success: true,
    resequencedBatchesCount: batches.length,
    resequencedOrdersCount: modifiedOrders.size,
  };
}

export interface DynamicSaleValuation {
  orderId: string;
  refNo: string;
  date: Date;
  quantity: number;
  unitCost: number;
  totalCogs: number;
  batchSplits?: any[];
}

export interface ProductSalesValuationResult {
  orderCostMap: Map<string, DynamicSaleValuation>;
  periodCogs: number;
  periodSoldQty: number;
  allTimeCogs: number;
  allTimeSoldQty: number;
  valuationMethod: string;
}

/**
 * Dynamically calculates the exact valuation cost rate and COGS for all sales of a product
 * using the real-time Moving Average / FIFO sequence timeline (identical to Valuation Ledger).
 */
export async function calculateProductDynamicSalesValuation(options: {
  userId: string;
  productId: string;
  fromDate?: Date | string | null;
  toDate?: Date | string | null;
  syncDatabase?: boolean;
}): Promise<ProductSalesValuationResult> {
  const { userId, productId, fromDate, toDate, syncDatabase = true } = options;
  const orderCostMap = new Map<string, DynamicSaleValuation>();

  if (!productId || !isValidObjectId(productId)) {
    return {
      orderCostMap,
      periodCogs: 0,
      periodSoldQty: 0,
      allTimeCogs: 0,
      allTimeSoldQty: 0,
      valuationMethod: "average",
    };
  }

  const uId = toObjectId(userId);
  const pId = toObjectId(productId);
  const valuationMethod = await getValuationMethod(userId);

  const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
  const product = await productsCollection.findOne({ _id: pId, user_id: uId });

  if (!product) {
    return {
      orderCostMap,
      periodCogs: 0,
      periodSoldQty: 0,
      allTimeCogs: 0,
      allTimeSoldQty: 0,
      valuationMethod,
    };
  }

  const batchesCollection = await getCollection(COLLECTIONS.INVENTORY_BATCHES);
  const purchaseBillsCollection = await getCollection(COLLECTIONS.PURCHASE_BILLS);
  const ordersCollection = await getCollection(COLLECTIONS.ORDERS);
  const saleReturnsCollection = await getCollection(COLLECTIONS.SALE_RETURN_TRANSACTIONS);
  const stockAdjustmentsCollection = await getCollection(
    (COLLECTIONS as any).STOCK_ADJUSTMENTS || "stock_adjustments"
  );

  const [batches, purchaseBills, orders, saleReturns, stockAdjustments] = await Promise.all([
    batchesCollection.find({ user_id: uId, product_id: { $in: [pId, productId] } }).toArray(),
    purchaseBillsCollection.find({ user_id: uId, "items.product_id": { $in: [pId, productId] } }).toArray(),
    ordersCollection.find({ user_id: uId, status: { $ne: "cancelled" }, "items.product_id": { $in: [pId, productId] } }).toArray(),
    saleReturnsCollection.find({
      user_id: uId,
      $or: [
        { "items.productId": productId },
        { "items.product_id": productId },
        { "items.productId": pId },
        { "items.product_id": pId },
      ],
    }).toArray(),
    stockAdjustmentsCollection.find({ user_id: uId, product_id: { $in: [pId, productId] } }).toArray(),
  ]);

  const getExactTimestamp = (dateVal: any, createdAtVal: any): Date => {
    if (!dateVal && !createdAtVal) return new Date();
    const base = dateVal ? new Date(dateVal) : new Date(createdAtVal);
    if (isNaN(base.getTime())) return createdAtVal ? new Date(createdAtVal) : new Date();

    if (createdAtVal) {
      const created = new Date(createdAtVal);
      if (!isNaN(created.getTime())) {
        base.setHours(created.getHours(), created.getMinutes(), created.getSeconds(), created.getMilliseconds());
      }
    }
    return base;
  };

  interface RawMovement {
    id: string;
    orderId?: string;
    date: Date;
    type: "opening_stock" | "purchase" | "sale" | "sale_return" | "adjustment_add" | "adjustment_reduce";
    refNo: string;
    inwardQty: number;
    outwardQty: number;
    unitRate: number;
    costPrice: number;
    totalAmount: number;
    batchSplits?: any[];
  }

  const rawMovements: RawMovement[] = [];

  // Opening stock determination
  const openingBatch = batches.find(
    (b: any) => b.source_type === "opening_stock" || b.batch_number === "OPENING"
  );
  let initialOpeningQty = openingBatch
    ? Number(openingBatch.initial_quantity) || 0
    : Number((product as any).opening_stock || (product as any).initial_quantity || 0);

  const productMasterCost = Number(product.cost_price ?? product.purchase_price ?? (product as any).initial_cost) || 0;
  let initialOpeningCost = 0;

  // Rule: If there are NO purchase bills yet, the opening cost MUST match the product's live master cost_price!
  if (purchaseBills.length === 0 && productMasterCost > 0) {
    initialOpeningCost = productMasterCost;
    if (openingBatch && Math.abs(Number(openingBatch.cost_price) - productMasterCost) > 0.001) {
      batchesCollection.updateOne(
        { _id: openingBatch._id },
        { $set: { cost_price: productMasterCost, updated_at: new Date() } }
      ).catch(err => console.error("Failed to sync opening batch cost in engine:", err));
    }
  } else if (openingBatch && Number(openingBatch.cost_price) > 0) {
    initialOpeningCost = Number(openingBatch.cost_price);
  } else {
    initialOpeningCost = productMasterCost;
  }

  if (initialOpeningCost <= 0) {
    const sortedOrders = [...orders].sort(
      (a, b) =>
        new Date(a.date || a.sale_date || a.created_at).getTime() -
        new Date(b.date || b.sale_date || b.created_at).getTime()
    );
    for (const ord of sortedOrders) {
      const item = (ord.items || []).find(
        (it: any) =>
          it.product_id?.toString() === productId ||
          it.product_id?.toString() === pId.toString()
      );
      if (item && Number(item.cost_price) > 0) {
        initialOpeningCost = Number(item.cost_price);
        break;
      }
    }
  }

  if (initialOpeningCost <= 0) {
    initialOpeningCost = Number((product as any).purchase_price || product.cost_price || 0);
  }

  const allTxDates: number[] = [];
  if (product.created_at) allTxDates.push(new Date(product.created_at).getTime());
  if (openingBatch?.batch_date) allTxDates.push(new Date(openingBatch.batch_date).getTime());
  if (openingBatch?.created_at) allTxDates.push(new Date(openingBatch.created_at).getTime());
  for (const b of purchaseBills) allTxDates.push(new Date(b.bill_date || b.created_at).getTime());
  for (const o of orders) allTxDates.push(new Date(o.sale_date || o.created_at).getTime());
  for (const a of stockAdjustments) allTxDates.push(new Date(a.date || a.created_at).getTime());
  const validTxDates = allTxDates.filter((t) => !isNaN(t) && t > 0);
  const earliestTx = validTxDates.length > 0 ? Math.min(...validTxDates) : Date.now();
  const openingDate = new Date(earliestTx);

  if (initialOpeningQty <= 0) {
    const totalPurchased = purchaseBills.reduce((acc, b) => {
      const matched = (b.items || []).filter(
        (it: any) =>
          it.product_id?.toString() === productId ||
          it.product_id?.toString() === pId.toString()
      );
      return acc + matched.reduce((mAcc: number, it: any) => mAcc + (Number(it.quantity) || 0), 0);
    }, 0);
    const totalSold = orders.reduce((acc, o) => {
      const matched = (o.items || []).filter(
        (it: any) =>
          it.product_id?.toString() === productId ||
          it.product_id?.toString() === pId.toString()
      );
      return acc + matched.reduce((mAcc: number, it: any) => mAcc + (Number(it.quantity) || 0), 0);
    }, 0);
    const totalAdjustAdd = stockAdjustments
      .filter((a: any) => a.action_type === "add")
      .reduce((acc: number, a: any) => acc + (Number(a.quantity) || 0), 0);
    const totalAdjustReduce = stockAdjustments
      .filter((a: any) => a.action_type !== "add")
      .reduce((acc: number, a: any) => acc + (Number(a.quantity) || 0), 0);
    const totalReturned = saleReturns.reduce((acc, r) => {
      const matched = (r.items || []).filter(
        (it: any) =>
          (it.productId || it.product_id)?.toString() === productId ||
          (it.productId || it.product_id)?.toString() === pId.toString()
      );
      return acc + matched.reduce((mAcc: number, it: any) => mAcc + (Number(it.quantity) || 0), 0);
    }, 0);
    const curStockNum = Number(product.quantity || product.in_stock || 0);
    const impliedOpening =
      Math.round(
        (curStockNum - (totalPurchased + totalAdjustAdd + totalReturned - totalSold - totalAdjustReduce)) * 1000
      ) / 1000;
    if (impliedOpening > 0) {
      initialOpeningQty = impliedOpening;
    }
  }

  rawMovements.push({
    id: `opening-${product._id}`,
    date: openingDate,
    type: "opening_stock",
    refNo: "OPENING",
    inwardQty: initialOpeningQty > 0 ? initialOpeningQty : 0,
    outwardQty: 0,
    unitRate: initialOpeningCost,
    costPrice: initialOpeningCost,
    totalAmount: Math.round(initialOpeningQty * initialOpeningCost * 100) / 100,
  });

  // Map Purchase Bills
  for (const bill of purchaseBills) {
    const d = getExactTimestamp(bill.bill_date || bill.date, bill.created_at);
    const matchedItems = (bill.items || []).filter(
      (it: any) =>
        it.product_id?.toString() === productId ||
        it.product_id?.toString() === pId.toString()
    );

    for (const it of matchedItems) {
      const qty = Number(it.quantity) || 0;
      const rate = Number(it.cost_price ?? it.unit_price) || 0;
      rawMovements.push({
        id: `pb-${bill._id}-${it.product_id}`,
        date: d,
        type: "purchase",
        refNo: bill.bill_number || `BILL-${bill._id.toString().slice(-6)}`,
        inwardQty: qty,
        outwardQty: 0,
        unitRate: rate,
        costPrice: rate,
        totalAmount: Math.round(qty * rate * 100) / 100,
      });
    }
  }

  // Map Sales Orders
  for (const order of orders) {
    const d = getExactTimestamp(order.sale_date || order.date, order.created_at);
    const matchedItems = (order.items || []).filter(
      (it: any) =>
        it.product_id?.toString() === productId ||
        it.product_id?.toString() === pId.toString()
    );

    for (const it of matchedItems) {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.price) || 0;
      const costPrice = Number(it.cost_price) || 0;
      const splits = Array.isArray(it.batch_splits) && it.batch_splits.length > 0 ? it.batch_splits : null;

      rawMovements.push({
        id: `so-${order._id}-${it.product_id}`,
        orderId: order._id.toString(),
        date: d,
        type: "sale",
        refNo: order.invoice_no || `INV-${order._id.toString().slice(-6)}`,
        inwardQty: 0,
        outwardQty: qty,
        unitRate: price,
        costPrice,
        totalAmount: Math.round(qty * price * 100) / 100,
        batchSplits: splits || [],
      });
    }
  }

  // Map Sale Returns
  for (const ret of saleReturns) {
    const d = getExactTimestamp(ret.return_date || ret.date, ret.created_at);
    const matchedItems = (ret.items || []).filter(
      (it: any) =>
        (it.productId || it.product_id)?.toString() === productId ||
        (it.productId || it.product_id)?.toString() === pId.toString()
    );

    for (const it of matchedItems) {
      const qty = Number(it.quantity) || 0;
      const returnCost =
        Number(it.costPrice ?? it.cost_price ?? product.cost_price ?? product.purchase_price) || 0;
      rawMovements.push({
        id: `sr-${ret._id}-${it.productId || it.product_id}`,
        date: d,
        type: "sale_return",
        refNo: ret.returnNumber || ret.return_number || `RET-${ret._id.toString().slice(-6)}`,
        inwardQty: qty,
        outwardQty: 0,
        unitRate: returnCost,
        costPrice: returnCost,
        totalAmount: Math.round(qty * returnCost * 100) / 100,
      });
    }
  }

  // Map Stock Adjustments
  for (const adj of stockAdjustments) {
    const d = getExactTimestamp(adj.date, adj.created_at);
    const qty = Number(adj.quantity) || 0;
    const isAdd = adj.action_type === "add";
    const rate = Number(adj.cost_price ?? (product as any).cost_price) || 0;

    rawMovements.push({
      id: `adj-${adj._id}`,
      date: d,
      type: isAdd ? "adjustment_add" : "adjustment_reduce",
      refNo: adj.ref_no || `ADJ-${adj._id.toString().slice(-6)}`,
      inwardQty: isAdd ? qty : 0,
      outwardQty: !isAdd ? qty : 0,
      unitRate: rate,
      costPrice: rate,
      totalAmount: Math.round(qty * rate * 100) / 100,
    });
  }

  let calculatedSales: Array<{
    orderId: string;
    refNo: string;
    date: Date;
    quantity: number;
    unitCost: number;
    totalCogs: number;
    batchSplits?: any[];
  }> = [];

  if (valuationMethod !== "fifo") {
    // Interleaved sequence for WAC
    const opening = rawMovements.find((m) => m.type === "opening_stock");
    const otherMoves = rawMovements.filter((m) => m.type !== "opening_stock");

    const inwardQueue = otherMoves
      .filter((m) => (m.inwardQty || 0) > 0)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const outwardQueue = otherMoves
      .filter((m) => (m.outwardQty || 0) > 0)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const sequence: RawMovement[] = [];
    let runningStock = 0;

    if (opening) {
      sequence.push(opening);
      runningStock += opening.inwardQty || 0;
    }

    while (outwardQueue.length > 0) {
      const nextSale = outwardQueue[0];

      while (
        inwardQueue.length > 0 &&
        new Date(inwardQueue[0].date).getTime() < new Date(nextSale.date).getTime()
      ) {
        const naturalInward = inwardQueue.shift()!;
        sequence.push(naturalInward);
        runningStock += naturalInward.inwardQty || 0;
      }

      while (runningStock < nextSale.outwardQty && inwardQueue.length > 0) {
        const deficitInward = inwardQueue.shift()!;
        sequence.push(deficitInward);
        runningStock += deficitInward.inwardQty || 0;
      }

      outwardQueue.shift();
      sequence.push(nextSale);
      runningStock -= nextSale.outwardQty;
    }

    while (inwardQueue.length > 0) {
      const remainingInward = inwardQueue.shift()!;
      sequence.push(remainingInward);
      runningStock += remainingInward.inwardQty || 0;
    }

    let runningBalance = 0;
    let runningWac =
      initialOpeningCost > 0
        ? initialOpeningCost
        : Number(product.cost_price ?? product.purchase_price) || 0;
    let priorFulfilledBudget = 0;

    for (const m of sequence) {
      const prevBal = runningBalance;
      const prevWac = runningWac;
      let effectiveWac = runningWac;

      if (m.type === "opening_stock") {
        runningBalance = Math.round((runningBalance + m.inwardQty) * 1000) / 1000;
        effectiveWac = m.unitRate > 0 ? m.unitRate : runningWac;
        runningWac = effectiveWac;
      } else if (m.type === "purchase") {
        const inQty = m.inwardQty;
        const inRate = m.unitRate;
        if (prevBal < 0 && prevWac > 0) {
          effectiveWac = calculateMovingAverageWithPrior(
            prevBal,
            prevWac,
            inQty,
            inRate,
            priorFulfilledBudget
          );
        } else {
          effectiveWac = calculateMovingAverage(prevBal, prevWac, inQty, inRate);
        }
        runningBalance = Math.round((runningBalance + inQty) * 1000) / 1000;
        runningWac = effectiveWac;
      } else if (m.type === "adjustment_add") {
        const inQty = m.inwardQty;
        const inRate = m.costPrice > 0 ? m.costPrice : prevWac;
        if (inRate > 0 && inRate !== prevWac) {
          effectiveWac =
            prevBal < 0
              ? calculateMovingAverageWithPrior(
                prevBal,
                prevWac,
                inQty,
                inRate,
                priorFulfilledBudget
              )
              : calculateMovingAverage(prevBal, prevWac, inQty, inRate);
          runningWac = effectiveWac;
        } else {
          effectiveWac = runningWac;
        }
        runningBalance = Math.round((runningBalance + inQty) * 1000) / 1000;
      } else if (m.type === "sale_return") {
        const dynamicRate = runningWac > 0 ? runningWac : (m.unitRate > 0 ? m.unitRate : prevWac);
        m.unitRate = dynamicRate;
        m.costPrice = dynamicRate;
        m.totalAmount = Math.round(m.inwardQty * dynamicRate * 100) / 100;
        runningBalance = Math.round((runningBalance + m.inwardQty) * 1000) / 1000;
        effectiveWac = runningWac > 0 ? runningWac : dynamicRate;
        runningWac = effectiveWac;
      } else if (m.type === "sale") {
        const outQty = m.outwardQty;
        effectiveWac = runningWac;
        if (prevBal > 0) {
          priorFulfilledBudget += Math.min(prevBal, outQty);
        }
        runningBalance = Math.round((runningBalance - outQty) * 1000) / 1000;
        const saleCogs = roundToPrecision(outQty * effectiveWac, 2);

        calculatedSales.push({
          orderId: m.orderId || "",
          refNo: m.refNo,
          date: m.date,
          quantity: outQty,
          unitCost: effectiveWac,
          totalCogs: saleCogs,
        });
      } else if (m.type === "adjustment_reduce") {
        const outQty = m.outwardQty;
        runningBalance = Math.round((runningBalance - outQty) * 1000) / 1000;
      }
    }
  } else {
    // FIFO mode: use batch splits
    for (const m of rawMovements) {
      if (m.type === "sale") {
        const splits = m.batchSplits || [];
        let saleCogs = 0;
        if (splits.length > 0) {
          saleCogs = splits.reduce(
            (acc: number, s: any) =>
              acc + (Number(s.total_cost) || Number(s.quantity) * Number(s.cost_price)),
            0
          );
        } else {
          saleCogs = roundToPrecision(m.outwardQty * m.costPrice, 2);
        }
        const unitCost =
          m.outwardQty > 0
            ? roundToPrecision(saleCogs / m.outwardQty, 4)
            : Number(product.cost_price) || 0;

        calculatedSales.push({
          orderId: m.orderId || "",
          refNo: m.refNo,
          date: m.date,
          quantity: m.outwardQty,
          unitCost,
          totalCogs: saleCogs,
          batchSplits: splits,
        });
      }
    }
  }

  // Populate orderCostMap and calculate totals
  let allTimeCogs = 0;
  let allTimeSoldQty = 0;
  let periodCogs = 0;
  let periodSoldQty = 0;

  const from = fromDate ? new Date(fromDate) : null;
  const to = toDate ? new Date(toDate) : null;

  for (const cs of calculatedSales) {
    if (!cs.orderId && !cs.refNo) continue;

    const existing = orderCostMap.get(cs.orderId) || orderCostMap.get(cs.refNo);
    if (existing) {
      existing.quantity = roundToPrecision(existing.quantity + cs.quantity, 5);
      existing.totalCogs = roundToPrecision(existing.totalCogs + cs.totalCogs, 2);
      existing.unitCost =
        existing.quantity > 0
          ? roundToPrecision(existing.totalCogs / existing.quantity, 4)
          : cs.unitCost;
      if (cs.batchSplits && cs.batchSplits.length > 0) {
        existing.batchSplits = [...(existing.batchSplits || []), ...cs.batchSplits];
      }
    } else {
      const entry: DynamicSaleValuation = {
        orderId: cs.orderId,
        refNo: cs.refNo,
        date: cs.date,
        quantity: cs.quantity,
        unitCost: cs.unitCost,
        totalCogs: cs.totalCogs,
        batchSplits: cs.batchSplits,
      };
      if (cs.orderId) orderCostMap.set(cs.orderId, entry);
      if (cs.refNo) orderCostMap.set(cs.refNo, entry);
    }

    allTimeCogs += cs.totalCogs;
    allTimeSoldQty += cs.quantity;

    const dTime = cs.date.getTime();
    const matchesFrom = !from || dTime >= from.getTime();
    const matchesTo = !to || dTime <= to.getTime();
    if (matchesFrom && matchesTo) {
      periodCogs += cs.totalCogs;
      periodSoldQty += cs.quantity;
    }
  }

  // Background sync to MongoDB order documents if in Average mode
  if (syncDatabase && valuationMethod !== "fifo") {
    try {
      for (const order of orders) {
        const orderIdStr = order._id.toString();
        const dyn = orderCostMap.get(orderIdStr) || orderCostMap.get(order.invoice_no);
        if (!dyn || dyn.unitCost <= 0) continue;

        let needsUpdate = false;
        const newItems = (order.items || []).map((it: any) => {
          const itProdId = it.product_id?.toString() || it.productId?.toString();
          if (itProdId === productId || itProdId === pId.toString()) {
            const curCost = Number(it.cost_price) || 0;
            const curCogs = Number(it.total_cogs) || 0;
            if (
              Math.abs(curCost - dyn.unitCost) > 0.001 ||
              Math.abs(curCogs - dyn.totalCogs) > 0.01
            ) {
              needsUpdate = true;
              return {
                ...it,
                cost_price: dyn.unitCost,
                total_cogs: dyn.totalCogs,
              };
            }
          }
          return it;
        });

        if (needsUpdate) {
          ordersCollection
            .updateOne(
              { _id: order._id },
              { $set: { items: newItems, updated_at: new Date() } }
            )
            .catch((e) => console.error("Order valuation sync error:", e));
        }
      }
    } catch (syncErr) {
      console.error("Failed to sync dynamic order valuation to db:", syncErr);
    }
  }

  return {
    orderCostMap,
    periodCogs: roundToPrecision(periodCogs, 2),
    periodSoldQty: roundToPrecision(periodSoldQty, 5),
    allTimeCogs: roundToPrecision(allTimeCogs, 2),
    allTimeSoldQty: roundToPrecision(allTimeSoldQty, 5),
    valuationMethod,
  };
}
