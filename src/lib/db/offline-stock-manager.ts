import { db } from "@/lib/db/offline-db";
import { calculateMovingAverage, calculateMovingAverageWithPrior } from "@/lib/inventory/valuation-calc";

const roundToPrecision = (num: number, decimals: number = 5) => {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
};

/**
 * Finds how many units of previous stock were fulfilled in oversold orders for a product.
 * Used when stock is negative and a replenishment purchase/adjustment arrives.
 */
export async function getOfflinePriorFulfilledQty(prodIdStr: string): Promise<number> {
  try {
    const allOrders = await db.orders.toArray();
    let priorFulfilled = 0;
    for (const o of allOrders) {
      if (o.status === "cancelled" || !Array.isArray(o.items)) continue;
      for (const it of o.items) {
        if (String(it.product_id) === prodIdStr) {
          const itQty = Number(it.quantity) || 0;
          const unfulfilled = Number(it.unfulfilled_quantity) || 0;
          priorFulfilled += Math.max(0, itQty - unfulfilled);
        }
      }
    }
    return priorFulfilled;
  } catch (err) {
    console.error("Error computing prior fulfilled qty offline:", err);
    return 0;
  }
}

export async function adjustOfflineStock(
  productId: string | number | undefined | null, 
  qtyChange: number // Positive for addition, negative for deduction
) {
  if (!productId || productId === "0" || qtyChange === 0) return;
  
  const prodIdStr = String(productId);
  const product = await db.products.get(prodIdStr);
  
  if (product) {
    const currentQty = parseFloat(product.quantity?.toString() || product.in_stock?.toString() || "0");
    const newQty = roundToPrecision(currentQty + parseFloat(qtyChange.toString()));
    
    await db.products.update(prodIdStr, { 
      quantity: newQty,
      in_stock: newQty
    });
  }
}

export async function adjustOfflineStockWithValuation(
  productId: string | number | undefined | null,
  qtyChange: number, // Positive for purchase addition, negative for deduction
  unitCostPrice?: number,
  batchInfo?: {
    source_id: string;
    batch_number?: string;
    batch_date?: string | Date;
  }
) {
  if (!productId || productId === "0" || qtyChange === 0) return;

  const prodIdStr = String(productId);
  const product = await db.products.get(prodIdStr);

  if (!product) return;

  const currentQty = parseFloat(product.quantity?.toString() || product.in_stock?.toString() || "0");
  const currentCost = parseFloat(product.cost_price?.toString() || product.purchase_price?.toString() || "0");
  const newQty = roundToPrecision(currentQty + parseFloat(qtyChange.toString()));

  const updateFields: any = {
    quantity: newQty,
    in_stock: newQty,
  };

  const valuationMethod = typeof window !== "undefined"
    ? (localStorage.getItem("setting_stockValuationMethod") || "average")
    : "average";

  if (qtyChange > 0 && typeof unitCostPrice === "number" && unitCostPrice >= 0) {
    let computedAverageCost = unitCostPrice;
    if (valuationMethod === "average") {
      let priorFulfilledQty = 0;
      if (currentQty < 0) {
        priorFulfilledQty = await getOfflinePriorFulfilledQty(prodIdStr);
      }
      computedAverageCost = calculateMovingAverageWithPrior(currentQty, currentCost, qtyChange, unitCostPrice, priorFulfilledQty);
      updateFields.cost_price = computedAverageCost;
      updateFields.cost_price_str = computedAverageCost.toString();
      updateFields.purchase_price = computedAverageCost;
    } else if (valuationMethod === "fifo") {
      updateFields.cost_price = unitCostPrice;
      updateFields.cost_price_str = unitCostPrice.toString();
      updateFields.purchase_price = unitCostPrice;
    }

    // Save batch into local Dexie inventory_batches
    if (batchInfo?.source_id) {
      try {
        const batchId = `local_batch_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        await db.inventory_batches.put({
          id: batchId,
          product_id: prodIdStr,
          source_type: "purchase_bill",
          source_id: batchInfo.source_id,
          batch_number: batchInfo.batch_number || "PUR",
          initial_quantity: qtyChange,
          remaining_quantity: qtyChange,
          cost_price: unitCostPrice,
          status: "active",
          batch_date: batchInfo.batch_date ? new Date(batchInfo.batch_date).toISOString() : new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (valuationMethod === "fifo") {
          await reconcileOfflineUnfulfilledSales(prodIdStr);
        } else if (valuationMethod === "average") {
          await reconcileOfflineAverageUnfulfilledSales(prodIdStr, computedAverageCost, qtyChange);
        }
      } catch (err) {
        console.error("Failed to save offline inventory batch:", err);
      }
    }
  } else if (qtyChange < 0 && batchInfo?.source_id) {
    // If reversing a bill, delete local batches for that source_id
    try {
      const batches = await db.inventory_batches.where("product_id").equals(prodIdStr).toArray();
      const billBatches = batches.filter((b: any) => b.source_id === batchInfo.source_id);
      for (const b of billBatches) {
        if (b.id) await db.inventory_batches.delete(b.id);
      }

      // Re-evaluate cost price from remaining batches
      const remainingBatches = batches.filter((b: any) => b.source_id !== batchInfo.source_id);
      if (valuationMethod === "fifo") {
        if (remainingBatches.length > 0) {
          remainingBatches.sort((a: any, b: any) => new Date(b.batch_date).getTime() - new Date(a.batch_date).getTime());
          const latestCost = Number(remainingBatches[0].cost_price) || 0;
          updateFields.cost_price = latestCost;
          updateFields.cost_price_str = latestCost.toString();
          updateFields.purchase_price = latestCost;
        }
      } else if (valuationMethod === "average") {
        let deletedCost = (typeof unitCostPrice === "number" && unitCostPrice > 0) ? unitCostPrice : 0;
        if (deletedCost <= 0 && billBatches.length > 0) {
          deletedCost = Number(billBatches[0].cost_price || 0);
        }
        if (deletedCost <= 0 && batchInfo?.source_id) {
          try {
            const billDoc = await db.purchase_bills.get(batchInfo.source_id);
            if (billDoc && Array.isArray(billDoc.items)) {
              const matched = billDoc.items.find((it: any) => String(it.product_id) === prodIdStr);
              if (matched) {
                deletedCost = Number(matched.cost_price ?? matched.purchase_price ?? matched.unit_price ?? matched.price ?? matched.sell_price ?? 0);
              }
            }
          } catch {
            // ignore
          }
        }
        if (deletedCost <= 0) {
          deletedCost = currentCost;
        }

        const removedQty = Math.abs(qtyChange);
        const prevQty = newQty;
        const prevTotalVal = (currentQty * currentCost) - (removedQty * deletedCost);

        if (prevQty > 0) {
          const restoredAvg = prevTotalVal > 0 ? roundToPrecision(prevTotalVal / prevQty, 2) : currentCost;
          updateFields.cost_price = restoredAvg;
          updateFields.cost_price_str = restoredAvg.toString();
          updateFields.purchase_price = restoredAvg;
        } else if (remainingBatches.length > 0) {
          let totalVal = 0;
          let totalRemQty = 0;
          for (const b of remainingBatches) {
            const bQty = Number(b.remaining_quantity ?? b.initial_quantity) || 0;
            totalVal += bQty * Number(b.cost_price || 0);
            totalRemQty += bQty;
          }
          if (totalRemQty > 0) {
            const restoredAvg = roundToPrecision(totalVal / totalRemQty, 2);
            updateFields.cost_price = restoredAvg;
            updateFields.cost_price_str = restoredAvg.toString();
            updateFields.purchase_price = restoredAvg;
          }
        } else {
          updateFields.cost_price = currentCost;
          updateFields.cost_price_str = currentCost.toString();
          updateFields.purchase_price = currentCost;
        }
      }
    } catch (err) {
      console.error("Failed to delete offline inventory batches:", err);
    }
  }

  await db.products.update(prodIdStr, updateFields);
}

/**
 * Offline FIFO batch consumption in local Dexie database:
 * 1. Reads active lots for product_id sorted by batch_date ascending.
 * 2. Consumes from earliest lot until saleQty is met.
 * 3. Updates Dexie db.inventory_batches.
 */
export async function consumeOfflineBatchesOnSale(options: {
  productId: string | number;
  saleQty: number;
  fallbackCostPrice?: number;
}): Promise<{
  consumed_batches: Array<{
    batch_id: string;
    batch_number?: string;
    quantity: number;
    cost_price: number;
    total_cost: number;
  }>;
  total_cogs: number;
  remaining_unfulfilled_qty: number;
  effective_unit_cost: number;
}> {
  const { productId, saleQty, fallbackCostPrice = 0 } = options;
  const prodIdStr = String(productId);

  if (saleQty <= 0) {
    return {
      consumed_batches: [],
      total_cogs: 0,
      remaining_unfulfilled_qty: 0,
      effective_unit_cost: fallbackCostPrice,
    };
  }

  try {
    const batches = await db.inventory_batches.where("product_id").equals(prodIdStr).toArray();
    const activeBatches = batches
      .filter((b: any) => (b.status === "active" || !b.status) && Number(b.remaining_quantity) > 0)
      .sort((a: any, b: any) => new Date(a.batch_date || a.created_at).getTime() - new Date(b.batch_date || b.created_at).getTime());

    let unfulfilledQty = saleQty;
    let totalCogs = 0;
    const consumedBatches: Array<{
      batch_id: string;
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
        batch_id: batch.id || batch._id,
        batch_number: batch.batch_number || "BATCH",
        quantity: takeQty,
        cost_price: costPrice,
        total_cost: splitCost,
      });

      totalCogs += splitCost;
      unfulfilledQty = roundToPrecision(unfulfilledQty - takeQty, 5);

      if (batch.id) {
        await db.inventory_batches.update(batch.id, {
          remaining_quantity: newRemaining,
          status: newRemaining <= 0 ? "depleted" : "active",
          updated_at: new Date().toISOString(),
        });
      }
    }

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
  } catch (err) {
    console.error("Error in consumeOfflineBatchesOnSale:", err);
    return {
      consumed_batches: [],
      total_cogs: roundToPrecision(saleQty * fallbackCostPrice, 2),
      remaining_unfulfilled_qty: 0,
      effective_unit_cost: fallbackCostPrice,
    };
  }
}

/**
 * Restores consumed quantities in local Dexie database when an offline order is cancelled.
 */
export async function restoreOfflineBatchesOnSaleRevert(options: {
  consumedBatches: Array<{
    batch_id: string;
    quantity: number;
  }>;
}): Promise<void> {
  const { consumedBatches } = options;
  if (!consumedBatches || !Array.isArray(consumedBatches) || consumedBatches.length === 0) return;

  for (const split of consumedBatches) {
    if (!split.batch_id) continue;
    const returnQty = Number(split.quantity) || 0;
    if (returnQty <= 0) continue;

    try {
      const batch = await db.inventory_batches.get(split.batch_id);
      if (batch) {
        const curRemaining = Number(batch.remaining_quantity) || 0;
        const newRemaining = roundToPrecision(curRemaining + returnQty, 5);
        await db.inventory_batches.update(split.batch_id, {
          remaining_quantity: newRemaining,
          status: "active",
          updated_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error("Failed to restore offline batch:", err);
    }
  }
}

/**
 * Re-inwards returned goods into local Dexie inventory batches on sale return.
 */
export async function reInwardOfflineBatchOnSaleReturn(options: {
  productId: string | number;
  quantity: number;
  costPrice: number;
  returnId: string;
  returnNumber: string;
  returnDate?: string | Date;
}): Promise<void> {
  const { productId, quantity, costPrice, returnId, returnNumber, returnDate } = options;
  const prodIdStr = String(productId);
  if (!prodIdStr || quantity <= 0) return;

  try {
    const batchId = `local_ret_batch_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await db.inventory_batches.put({
      id: batchId,
      product_id: prodIdStr,
      source_type: "sale_return",
      source_id: returnId,
      batch_number: `RET-${returnNumber || "SR"}`,
      initial_quantity: quantity,
      remaining_quantity: quantity,
      cost_price: costPrice,
      status: "active",
      batch_date: returnDate ? new Date(returnDate).toISOString() : new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const valuationMethod = typeof window !== "undefined"
      ? (localStorage.getItem("setting_stockValuationMethod") || "average")
      : "average";

    if (valuationMethod === "fifo") {
      await reconcileOfflineUnfulfilledSales(prodIdStr);
    } else if (valuationMethod === "average") {
      let finalAvgCost = costPrice;
      const product = await db.products.get(prodIdStr);
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
        await db.products.update(prodIdStr, {
          cost_price: finalAvgCost,
          cost_price_str: finalAvgCost.toString(),
          purchase_price: finalAvgCost,
        });
      }
      if (finalAvgCost > 0) {
        await reconcileOfflineAverageUnfulfilledSales(prodIdStr, finalAvgCost, quantity);
      }
    }
  } catch (err) {
    console.error("Failed to save offline sale return batch:", err);
  }
}

/**
 * Auto-reconciles unfulfilled sales in Dexie offline database when a new batch is added offline.
 */
export async function reconcileOfflineUnfulfilledSales(productId: string | number): Promise<void> {
  const prodIdStr = String(productId);
  if (!prodIdStr) return;

  try {
    const valuationMethod = typeof window !== "undefined"
      ? (localStorage.getItem("setting_stockValuationMethod") || "average")
      : "average";

    if (valuationMethod !== "fifo") return;

    const batches = await db.inventory_batches.where("product_id").equals(prodIdStr).toArray();
    const activeBatches = batches
      .filter((b: any) => (b.status === "active" || !b.status) && Number(b.remaining_quantity) > 0)
      .sort((a: any, b: any) => new Date(a.batch_date || a.created_at).getTime() - new Date(b.batch_date || b.created_at).getTime());

    if (activeBatches.length === 0) return;

    const allOrders = await db.orders.toArray();
    const candidateOrders = allOrders
      .filter((o: any) => o.status !== "cancelled" && Array.isArray(o.items) && o.items.some((it: any) => String(it.product_id) === prodIdStr))
      .sort((a: any, b: any) => new Date(a.sale_date || a.created_at).getTime() - new Date(b.sale_date || b.created_at).getTime());

    for (const order of candidateOrders) {
      let orderModified = false;
      const items = order.items || [];

      for (const item of items) {
        if (String(item.product_id) !== prodIdStr) continue;

        const itemQty = Number(item.quantity) || 0;
        if (itemQty <= 0) continue;

        const currentSplits = Array.isArray(item.batch_splits) ? [...item.batch_splits] : [];
        const fulfilledQty = currentSplits.reduce((acc: number, sp: any) => acc + (Number(sp.quantity) || 0), 0);
        let deficitQty = Math.max(0, roundToPrecision(itemQty - fulfilledQty, 5));

        if (deficitQty <= 0) {
          if (item.unfulfilled_quantity !== 0 || item.is_oversold !== false) {
            item.unfulfilled_quantity = 0;
            item.is_oversold = false;
            orderModified = true;
          }
          continue;
        }

        let unitsFulfilled = 0;

        for (const batch of activeBatches) {
          if (deficitQty <= 0) break;
          const available = Number(batch.remaining_quantity) || 0;
          if (available <= 0) continue;

          const takeQty = Math.min(available, deficitQty);
          const newRemaining = roundToPrecision(available - takeQty, 5);
          const bCost = Number(batch.cost_price) || 0;
          const splitCost = roundToPrecision(takeQty * bCost, 2);

          batch.remaining_quantity = newRemaining;
          batch.status = newRemaining <= 0 ? "depleted" : "active";
          if (batch.id) {
            await db.inventory_batches.update(batch.id, {
              remaining_quantity: newRemaining,
              status: batch.status,
              updated_at: new Date().toISOString(),
            });
          }

          currentSplits.push({
            batch_id: batch.id || batch._id,
            batch_number: batch.batch_number || "BATCH",
            quantity: takeQty,
            cost_price: bCost,
            total_cost: splitCost,
            reconciled_at: new Date().toISOString(),
          });

          deficitQty = roundToPrecision(deficitQty - takeQty, 5);
          unitsFulfilled += takeQty;
        }

        if (unitsFulfilled > 0) {
          item.batch_splits = currentSplits;
          item.unfulfilled_quantity = deficitQty;
          item.is_oversold = deficitQty > 0;

          const splitsCostTotal = currentSplits.reduce((acc: number, sp: any) => acc + (Number(sp.total_cost) || 0), 0);
          const fallback = Number(item.cost_price) || 0;
          const newTotalCogs = roundToPrecision(splitsCostTotal + (deficitQty * fallback), 2);
          item.total_cogs = newTotalCogs;
          item.cost_price = itemQty > 0 ? roundToPrecision(newTotalCogs / itemQty, 2) : fallback;

          orderModified = true;
        }
      }

      if (orderModified && order.id) {
        await db.orders.update(order.id, {
          items,
          updated_at: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    console.error("Failed to reconcile offline unfulfilled sales:", err);
  }
}

/**
 * Auto-reconciles past zero-cost or oversold sales in Dexie offline database when a new purchase or return arrives under the Average Method.
 */
export async function reconcileOfflineAverageUnfulfilledSales(
  productId: string | number,
  newAverageCost: number,
  inwardQty: number = 0
): Promise<void> {
  const prodIdStr = String(productId);
  if (!prodIdStr || newAverageCost <= 0) return;

  try {
    const product = await db.products.get(prodIdStr);
    const allOrders = await db.orders.toArray();
    const candidateOrders = allOrders
      .filter((o: any) => o.status !== "cancelled" && Array.isArray(o.items) && o.items.some((it: any) => String(it.product_id) === prodIdStr))
      .sort((a: any, b: any) => new Date(a.sale_date || a.created_at).getTime() - new Date(b.sale_date || b.created_at).getTime());

    // Calculate total acquired stock to accurately know which sales were oversold (self-healing)
    const batches = await db.inventory_batches.where("product_id").equals(prodIdStr).toArray();
    const initialBatchQty = batches.reduce((acc: number, b: any) => acc + (Number(b.initial_quantity) || 0), 0);
    const curStock = parseFloat(product?.quantity?.toString() || product?.in_stock?.toString() || "0");
    const totalSold = candidateOrders.reduce((acc: number, ord: any) => {
      const match = (ord.items || []).find((it: any) => String(it.product_id) === prodIdStr);
      return acc + (Number(match?.quantity) || 0);
    }, 0);
    const totalHistoricalAcquired = Math.max(initialBatchQty, curStock + totalSold);

    let runningFulfilledBudget = roundToPrecision(totalHistoricalAcquired - (Number(inwardQty) || 0), 5);
    let remainingInward = Number(inwardQty) > 0 ? Number(inwardQty) : 0;

    for (const order of candidateOrders) {
      let orderModified = false;
      const items = order.items || [];

      for (const item of items) {
        if (String(item.product_id) !== prodIdStr) continue;

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
            item.cost_price = newAverageCost;
            item.total_cogs = roundToPrecision(itemQty * newAverageCost, 2);
            orderModified = true;
          } else {
            // Not enough inward units to fulfill this invoice; keep unfulfilled and is_oversold
            item.unfulfilled_quantity = unfulfilled;
            item.is_oversold = true;
            // Update estimated COGS to new average so report displays latest rate
            item.cost_price = newAverageCost;
            item.total_cogs = roundToPrecision(itemQty * newAverageCost, 2);
            orderModified = true;
          }
        } else if (currentCost <= 0 || currentCogs <= 0) {
          item.cost_price = newAverageCost;
          item.total_cogs = roundToPrecision(itemQty * newAverageCost, 2);
          orderModified = true;
        }
      }

      if (orderModified && order.id) {
        await db.orders.update(order.id, {
          items,
          updated_at: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    console.error("Failed to reconcile offline average unfulfilled sales:", err);
  }
}

/**
 * Records a stock adjustment locally in Dexie database with FIFO/Average valuation handling
 * and logs it into db.stock_adjustments.
 */
export async function recordStockAdjustmentOffline(options: {
  productId: string | number;
  stockType: "available" | "damaged";
  actionType: "add" | "reduce";
  quantity: number;
  reason: string;
  notes?: string;
  adjustmentDate?: string | Date;
  costPrice?: number;
}): Promise<{
  newQuantity: number;
  newDamagedQuantity: number;
  newCostPrice: number;
}> {
  const {
    productId,
    stockType,
    actionType,
    quantity,
    reason,
    notes,
    adjustmentDate,
    costPrice,
  } = options;

  const prodIdStr = String(productId);
  const product = await db.products.get(prodIdStr);
  if (!product || quantity <= 0) {
    return {
      newQuantity: Number(product?.quantity || 0),
      newDamagedQuantity: Number(product?.damaged_quantity || 0),
      newCostPrice: Number(product?.cost_price || product?.purchase_price || 0),
    };
  }

  const curQty = parseFloat(product.quantity?.toString() || product.in_stock?.toString() || "0");
  const curDamaged = parseFloat(product.damaged_quantity?.toString() || "0");
  const curCost = parseFloat(product.cost_price?.toString() || product.purchase_price?.toString() || "0");
  const resolvedCost = typeof costPrice === "number" && costPrice >= 0 ? costPrice : curCost;

  const isCostPriceExplicitlyChanged = typeof costPrice === "number" && costPrice >= 0 && (costPrice !== curCost || curCost <= 0);

  let newQty = curQty;
  let newDamaged = curDamaged;
  let finalCostPrice = curCost;

  const valuationMethod = typeof window !== "undefined"
    ? (localStorage.getItem("setting_stockValuationMethod") || "average")
    : "average";

  if (stockType === "damaged") {
    newDamaged = actionType === "add"
      ? roundToPrecision(curDamaged + quantity)
      : Math.max(0, roundToPrecision(curDamaged - quantity));

    await db.products.update(prodIdStr, {
      damaged_quantity: newDamaged,
      damaged_quantity_str: newDamaged.toString(),
    });
  } else {
    // Available stock adjustment
    if (actionType === "add") {
      newQty = roundToPrecision(curQty + quantity);
      const updateFields: any = {
        quantity: newQty,
        quantity_str: newQty.toString(),
        in_stock: newQty,
      };

      if (valuationMethod === "fifo") {
        const batchId = `local_adj_batch_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        await db.inventory_batches.put({
          id: batchId,
          product_id: prodIdStr,
          source_type: "stock_adjustment",
          source_id: `adj_${Date.now()}`,
          batch_number: `ADJ-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}`,
          initial_quantity: quantity,
          remaining_quantity: quantity,
          cost_price: resolvedCost,
          status: "active",
          batch_date: adjustmentDate ? new Date(adjustmentDate).toISOString() : new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        if (resolvedCost > 0) {
          finalCostPrice = resolvedCost;
          updateFields.cost_price = resolvedCost;
          updateFields.cost_price_str = resolvedCost.toString();
          updateFields.purchase_price = resolvedCost;
        }
        await reconcileOfflineUnfulfilledSales(prodIdStr);
      } else if (valuationMethod === "average") {
        // If user changed the cost price in dialog, calculate moving average; otherwise preserve old cost
        if (isCostPriceExplicitlyChanged && resolvedCost > 0) {
          let priorFulfilledQty = 0;
          if (curQty < 0) {
            priorFulfilledQty = await getOfflinePriorFulfilledQty(prodIdStr);
          }
          const newAvgCost = calculateMovingAverageWithPrior(curQty, curCost, quantity, resolvedCost, priorFulfilledQty);
          finalCostPrice = newAvgCost;
          updateFields.cost_price = newAvgCost;
          updateFields.cost_price_str = newAvgCost.toString();
          updateFields.purchase_price = newAvgCost;
          await reconcileOfflineAverageUnfulfilledSales(prodIdStr, newAvgCost, quantity);
        } else {
          finalCostPrice = curCost;
        }
      }

      await db.products.update(prodIdStr, updateFields);
    } else {
      // actionType === "reduce"
      newQty = Math.max(0, roundToPrecision(curQty - quantity));

      if (valuationMethod === "fifo") {
        await consumeOfflineBatchesOnSale({
          productId: prodIdStr,
          saleQty: quantity,
          fallbackCostPrice: curCost,
        });
      }

      await db.products.update(prodIdStr, {
        quantity: newQty,
        quantity_str: newQty.toString(),
        in_stock: newQty,
      });
    }
  }

  // Save audit entry in Dexie db.stock_adjustments
  const adjId = `adj_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const dateIso = adjustmentDate ? new Date(adjustmentDate).toISOString() : new Date().toISOString();

  await db.stock_adjustments.put({
    id: adjId,
    product_id: prodIdStr,
    product_name: product.name,
    stock_type: stockType,
    action_type: actionType,
    quantity,
    cost_price: resolvedCost,
    reason,
    notes: notes?.trim() || "",
    date: dateIso,
    created_at: new Date().toISOString(),
  });

  return {
    newQuantity: newQty,
    newDamagedQuantity: newDamaged,
    newCostPrice: finalCostPrice,
  };
}


