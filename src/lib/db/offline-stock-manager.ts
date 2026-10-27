import { db } from "@/lib/db/offline-db";
import { calculateMovingAverage, calculateMovingAverageWithPrior } from "@/lib/inventory/valuation-calc";
import { SyncEngine } from "@/lib/sync/sync-engine";

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
    previous_cost_price: curCost,
    previous_quantity: curQty,
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

/**
 * Deletes a stock adjustment locally in Dexie database, reverses its quantity and cost price impact,
 * and queues synchronization for the server.
 */
export async function deleteStockAdjustmentOffline(options: {
  adjustmentId: string;
  fallbackRecord?: any;
}): Promise<{
  deleted: boolean;
  productId: string;
  newQuantity: number;
  newDamagedQuantity: number;
  newCostPrice: number;
}> {
  const { adjustmentId, fallbackRecord } = options;
  if (!adjustmentId) {
    return { deleted: false, productId: "", newQuantity: 0, newDamagedQuantity: 0, newCostPrice: 0 };
  }

  // 1. Fetch adjustment from Dexie or fallback
  let adj = await db.stock_adjustments.get(adjustmentId);
  if (!adj && fallbackRecord) {
    adj = fallbackRecord;
  }
  if (!adj) {
    const all = await db.stock_adjustments.toArray();
    adj = all.find((a: any) => a.id === adjustmentId || a._id === adjustmentId || (fallbackRecord?.ref_no && a.ref_no === fallbackRecord.ref_no));
  }

  if (!adj) {
    return { deleted: false, productId: "", newQuantity: 0, newDamagedQuantity: 0, newCostPrice: 0 };
  }

  const prodIdStr = String(adj.product_id);
  const product = await db.products.get(prodIdStr);

  let newQty = 0;
  let newDamaged = 0;
  let newCost = 0;

  if (product) {
    const curQty = parseFloat(product.quantity?.toString() || product.in_stock?.toString() || "0");
    const curDamaged = parseFloat(product.damaged_quantity?.toString() || "0");
    const curCost = parseFloat(product.cost_price?.toString() || product.purchase_price?.toString() || "0");
    const adjQty = Number(adj.quantity) || 0;
    const adjCost = Number(adj.cost_price ?? curCost) || 0;

    const valuationMethod = typeof window !== "undefined"
      ? (localStorage.getItem("setting_stockValuationMethod") || "average")
      : "average";

    newQty = curQty;
    newDamaged = curDamaged;
    newCost = curCost;

    if (adj.stock_type === "damaged") {
      newDamaged = adj.action_type === "add"
        ? Math.max(0, roundToPrecision(curDamaged - adjQty))
        : roundToPrecision(curDamaged + adjQty);

      await db.products.update(prodIdStr, {
        damaged_quantity: newDamaged,
        damaged_quantity_str: newDamaged.toString(),
      });
    } else {
      // Available stock reversal
      if (adj.action_type === "add") {
        // Was ADDED -> Reversal DEDUCTS stock
        newQty = roundToPrecision(curQty - adjQty);
        const updateFields: any = {
          quantity: newQty,
          quantity_str: newQty.toString(),
          in_stock: newQty,
        };

        if (valuationMethod === "average") {
          const prevQty = newQty;

          // Case 1: If current stock was ALREADY in deficit (curQty <= 0) before this deletion:
          // Deleting a past inward simply expands the deficit. The current replacement benchmark cost (curCost) MUST NOT be changed!
          if (curQty <= 0) {
            newCost = curCost;
          } else if (prevQty > 0) {
            // Case 2: Stock remains positive after deletion.
            // Deduct the value of the removed adjustment from today's total valuation.
            const prevTotalVal = (curQty * curCost) - (adjQty * adjCost);
            if (prevTotalVal > 0) {
              const restoredAvg = roundToPrecision(prevTotalVal / prevQty, 2);
              newCost = restoredAvg;
              updateFields.cost_price = restoredAvg;
              updateFields.cost_price_str = restoredAvg.toString();
              updateFields.purchase_price = restoredAvg;
            } else {
              newCost = curCost;
            }
          } else {
            // Check if any newer inward transactions (purchase bills or adjustments) happened AFTER this adjustment (by date or same-day time):
            const adjDateMs = new Date(adj.date || adj.created_at).getTime();
            const adjCreatedMs = new Date(adj.created_at || adj.date).getTime();
            let hasSubsequentInward = false;
            try {
              // 1. Check all stock adjustments for this product
              const adjustments = await db.stock_adjustments.where("product_id").equals(prodIdStr).toArray();
              hasSubsequentInward = adjustments.some((a: any) => {
                if (a.id === adj.id || a._id === adj.id || (adj.ref_no && a.ref_no === adj.ref_no)) return false;
                const aDateMs = new Date(a.date || a.created_at).getTime();
                const aCreatedMs = new Date(a.created_at || a.date).getTime();
                return aDateMs > adjDateMs || (aDateMs === adjDateMs && aCreatedMs > adjCreatedMs);
              });

              // 2. Check all purchase bills for this product
              if (!hasSubsequentInward) {
                const bills = await db.purchase_bills.toArray();
                hasSubsequentInward = bills.some((b: any) => {
                  const bDateMs = new Date(b.date || b.created_at).getTime();
                  const bCreatedMs = new Date(b.created_at || b.date).getTime();
                  const isNewer = bDateMs > adjDateMs || (bDateMs === adjDateMs && bCreatedMs > adjCreatedMs);
                  if (!isNewer) return false;
                  return (b.items || []).some((it: any) => String(it.product_id) === prodIdStr && Number(it.quantity) > 0);
                });
              }
            } catch {
              hasSubsequentInward = false;
            }

            if (!hasSubsequentInward && adj.previous_cost_price !== undefined && adj.previous_cost_price !== null && Number(adj.previous_cost_price) > 0) {
              // No subsequent inwards existed: this adjustment was the ONLY transaction lifting stock. Restore its previous snapshot!
              const restored = Number(adj.previous_cost_price);
              newCost = restored;
              updateFields.cost_price = restored;
              updateFields.cost_price_str = restored.toString();
              updateFields.purchase_price = restored;
            } else {
              // Newer inwards happened after this adjustment, so current cost is governed by those newer transactions!
              newCost = curCost;
            }
          }
        } else if (valuationMethod === "fifo") {
          try {
            const batches = await db.inventory_batches.where("product_id").equals(prodIdStr).toArray();
            const remainingBatches = batches.filter((b: any) => b.source_id !== adj.id && b.source_id !== adj.ref_no);
            if (remainingBatches.length > 0) {
              remainingBatches.sort((a: any, b: any) => new Date(b.batch_date || b.created_at).getTime() - new Date(a.batch_date || a.created_at).getTime());
              const latestCost = Number(remainingBatches[0].cost_price) || 0;
              if (latestCost > 0) {
                newCost = latestCost;
                updateFields.cost_price = latestCost;
                updateFields.cost_price_str = latestCost.toString();
                updateFields.purchase_price = latestCost;
              }
            }
          } catch (err) {
            console.error("Error updating FIFO batches on delete:", err);
          }
        }

        await db.products.update(prodIdStr, updateFields);
      } else {
        // Was REDUCED -> Reversal ADDS BACK stock
        newQty = roundToPrecision(curQty + adjQty);
        await db.products.update(prodIdStr, {
          quantity: newQty,
          quantity_str: newQty.toString(),
          in_stock: newQty,
        });
      }
    }

    // Clean up any batch lots created for this adjustment
    try {
      const batches = await db.inventory_batches.where("product_id").equals(prodIdStr).toArray();
      const adjBatches = batches.filter((b: any) => b.source_id === adj.id || b.source_id === adj.ref_no);
      for (const b of adjBatches) {
        if (b.id) await db.inventory_batches.delete(b.id);
      }
    } catch (bErr) {
      console.error("Failed to delete inventory batches for adjustment:", bErr);
    }
  }

  // Delete from db.stock_adjustments
  if (adj.id) {
    await db.stock_adjustments.delete(adj.id);
  }
  if (adjustmentId !== adj.id) {
    await db.stock_adjustments.delete(adjustmentId);
  }

  // Queue background sync
  try {
    await SyncEngine.queueOperation(
      "stock_adjustments",
      "DELETE",
      `/api/stock-adjustments?id=${encodeURIComponent(adjustmentId)}&productId=${encodeURIComponent(prodIdStr)}`,
      { id: adjustmentId, productId: prodIdStr },
      `del_adj_${Date.now()}`
    );
  } catch (syncErr) {
    console.error("Failed to queue stock adjustment deletion sync:", syncErr);
  }

  return {
    deleted: true,
    productId: prodIdStr,
    newQuantity: newQty,
    newDamagedQuantity: newDamaged,
    newCostPrice: newCost,
  };
}

/**
 * Updates an existing stock adjustment:
 * 1. Reverses the old adjustment impact on stock and moving average / FIFO cost.
 * 2. Applies the new adjustment parameters and recalculates stock and moving average.
 * 3. Updates db.stock_adjustments and queues PUT sync for MongoDB.
 */
export async function updateStockAdjustmentOffline(options: {
  adjustmentId: string;
  productId: string | number;
  stockType: "available" | "damaged";
  actionType: "add" | "reduce";
  quantity: number;
  costPrice?: number;
  reason: string;
  notes?: string;
  adjustmentDate?: string | Date;
  fallbackOldRecord?: any;
}): Promise<{
  updated: boolean;
  newQuantity: number;
  newDamagedQuantity: number;
  newCostPrice: number;
}> {
  const {
    adjustmentId,
    productId,
    stockType,
    actionType,
    quantity,
    costPrice,
    reason,
    notes,
    adjustmentDate,
    fallbackOldRecord,
  } = options;

  // 1. Fetch old adjustment
  let oldAdj = await db.stock_adjustments.get(adjustmentId);
  if (!oldAdj && fallbackOldRecord) {
    oldAdj = fallbackOldRecord;
  }
  if (!oldAdj) {
    const all = await db.stock_adjustments.toArray();
    oldAdj = all.find((a: any) => a.id === adjustmentId || a._id === adjustmentId || (fallbackOldRecord?.ref_no && a.ref_no === fallbackOldRecord.ref_no));
  }

  const prodIdStr = String(productId);
  const product = await db.products.get(prodIdStr);

  if (!product || quantity <= 0) {
    return {
      updated: false,
      newQuantity: Number(product?.quantity || 0),
      newDamagedQuantity: Number(product?.damaged_quantity || 0),
      newCostPrice: Number(product?.cost_price || 0),
    };
  }

  const valuationMethod = typeof window !== "undefined"
    ? (localStorage.getItem("setting_stockValuationMethod") || "average")
    : "average";

  let curQty = parseFloat(product.quantity?.toString() || product.in_stock?.toString() || "0");
  let curDamaged = parseFloat(product.damaged_quantity?.toString() || "0");
  let curCost = parseFloat(product.cost_price?.toString() || product.purchase_price?.toString() || "0");

  // Step 1: Revert old adjustment if available
  if (oldAdj) {
    const oldQty = Number(oldAdj.quantity) || 0;
    const oldCost = Number(oldAdj.cost_price ?? curCost) || 0;

    if (oldAdj.stock_type === "damaged") {
      curDamaged = oldAdj.action_type === "add"
        ? Math.max(0, roundToPrecision(curDamaged - oldQty))
        : roundToPrecision(curDamaged + oldQty);
    } else {
      if (oldAdj.action_type === "add") {
        if (valuationMethod === "average") {
          if (curQty <= 0) {
            // Stock was already negative, curCost does not change
          } else if (curQty - oldQty > 0) {
            const prevTotalVal = (curQty * curCost) - (oldQty * oldCost);
            if (prevTotalVal > 0) {
              curCost = roundToPrecision(prevTotalVal / (curQty - oldQty), 2);
            }
            // Reverting pushes stock into deficit/zero: check subsequent inwards (adjustments or bills by date/time)
            const oldDateMs = new Date(oldAdj.date || oldAdj.created_at).getTime();
            const oldCreatedMs = new Date(oldAdj.created_at || oldAdj.date).getTime();
            let hasSubsequentInward = false;
            try {
              const adjustments = await db.stock_adjustments.where("product_id").equals(prodIdStr).toArray();
              hasSubsequentInward = adjustments.some((a: any) => {
                if (a.id === oldAdj.id || a._id === oldAdj.id || (oldAdj.ref_no && a.ref_no === oldAdj.ref_no)) return false;
                const aDateMs = new Date(a.date || a.created_at).getTime();
                const aCreatedMs = new Date(a.created_at || a.date).getTime();
                return aDateMs > oldDateMs || (aDateMs === oldDateMs && aCreatedMs > oldCreatedMs);
              });

              if (!hasSubsequentInward) {
                const bills = await db.purchase_bills.toArray();
                hasSubsequentInward = bills.some((b: any) => {
                  const bDateMs = new Date(b.date || b.created_at).getTime();
                  const bCreatedMs = new Date(b.created_at || b.date).getTime();
                  const isNewer = bDateMs > oldDateMs || (bDateMs === oldDateMs && bCreatedMs > oldCreatedMs);
                  if (!isNewer) return false;
                  return (b.items || []).some((it: any) => String(it.product_id) === prodIdStr && Number(it.quantity) > 0);
                });
              }
            } catch {
              hasSubsequentInward = false;
            }

            if (!hasSubsequentInward && oldAdj.previous_cost_price !== undefined && oldAdj.previous_cost_price !== null && Number(oldAdj.previous_cost_price) > 0) {
              curCost = Number(oldAdj.previous_cost_price);
            }
          }
        }
        curQty = roundToPrecision(curQty - oldQty);
      } else {
        curQty = roundToPrecision(curQty + oldQty);
      }
    }

    // Clean up old batch from Dexie
    try {
      const batches = await db.inventory_batches.where("product_id").equals(prodIdStr).toArray();
      const adjBatches = batches.filter((b: any) => b.source_id === oldAdj.id || b.source_id === oldAdj.ref_no);
      for (const b of adjBatches) {
        if (b.id) await db.inventory_batches.delete(b.id);
      }
    } catch (e) {
      // ignore
    }
  }

  // Step 2: Apply new adjustment on intermediate (reverted) stock & cost
  const resolvedCost = typeof costPrice === "number" && costPrice >= 0 ? costPrice : curCost;
  let finalQty = curQty;
  let finalDamaged = curDamaged;
  let finalCost = curCost;

  if (stockType === "damaged") {
    finalDamaged = actionType === "add"
      ? roundToPrecision(curDamaged + quantity)
      : Math.max(0, roundToPrecision(curDamaged - quantity));

    await db.products.update(prodIdStr, {
      damaged_quantity: finalDamaged,
      damaged_quantity_str: finalDamaged.toString(),
    });
  } else {
    if (actionType === "add") {
      finalQty = roundToPrecision(curQty + quantity);
      const updateFields: any = {
        quantity: finalQty,
        quantity_str: finalQty.toString(),
        in_stock: finalQty,
      };

      if (valuationMethod === "fifo") {
        const batchId = `local_adj_batch_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        await db.inventory_batches.put({
          id: batchId,
          product_id: prodIdStr,
          source_type: "stock_adjustment",
          source_id: oldAdj?.id || `adj_${Date.now()}`,
          batch_number: oldAdj?.ref_no || `ADJ-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}`,
          initial_quantity: quantity,
          remaining_quantity: quantity,
          cost_price: resolvedCost,
          status: "active",
          batch_date: adjustmentDate ? new Date(adjustmentDate).toISOString() : new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        if (resolvedCost > 0) {
          finalCost = resolvedCost;
          updateFields.cost_price = resolvedCost;
          updateFields.cost_price_str = resolvedCost.toString();
          updateFields.purchase_price = resolvedCost;
        }
        await reconcileOfflineUnfulfilledSales(prodIdStr);
      } else if (valuationMethod === "average") {
        let priorFulfilledQty = 0;
        if (curQty < 0) {
          priorFulfilledQty = await getOfflinePriorFulfilledQty(prodIdStr);
        }
        const newAvgCost = calculateMovingAverageWithPrior(curQty, curCost, quantity, resolvedCost, priorFulfilledQty);
        finalCost = newAvgCost;
        updateFields.cost_price = newAvgCost;
        updateFields.cost_price_str = newAvgCost.toString();
        updateFields.purchase_price = newAvgCost;
        await reconcileOfflineAverageUnfulfilledSales(prodIdStr, newAvgCost, quantity);
      }

      await db.products.update(prodIdStr, updateFields);
    } else {
      // actionType === "reduce"
      finalQty = Math.max(0, roundToPrecision(curQty - quantity));
      await db.products.update(prodIdStr, {
        quantity: finalQty,
        quantity_str: finalQty.toString(),
        in_stock: finalQty,
      });
    }
  }

  // Step 3: Update db.stock_adjustments record
  const dateIso = adjustmentDate ? new Date(adjustmentDate).toISOString() : (oldAdj?.date || new Date().toISOString());
  const updatedAdjRecord = {
    ...(oldAdj || {}),
    id: adjustmentId,
    product_id: prodIdStr,
    product_name: product.name,
    stock_type: stockType,
    action_type: actionType,
    quantity,
    cost_price: resolvedCost,
    reason,
    notes: notes?.trim() || "",
    date: dateIso,
    updated_at: new Date().toISOString(),
  };

  await db.stock_adjustments.put(updatedAdjRecord);

  // Queue PUT sync operation
  try {
    await SyncEngine.queueOperation(
      "stock_adjustments",
      "PUT",
      "/api/stock-adjustments",
      {
        id: adjustmentId,
        productId: prodIdStr,
        stockType,
        actionType,
        quantity,
        costPrice: resolvedCost,
        reason,
        notes: notes?.trim() || "",
        adjustmentDate: dateIso,
      },
      `update_adj_${Date.now()}`
    );
  } catch (syncErr) {
    console.error("Failed to queue stock adjustment update sync:", syncErr);
  }

  return {
    updated: true,
    newQuantity: finalQty,
    newDamagedQuantity: finalDamaged,
    newCostPrice: finalCost,
  };
}

/**
 * Loads and computes complete stock valuation movement history from Dexie offline database.
 * Computes running balance, running WAC cost, and running stock valuation.
 */
export async function getOfflineProductStockValuationHistory(options: {
  productId: string | number;
  fromDate?: string;
  toDate?: string;
  mode?: "valuation" | "movement" | string;
}) {
  const { productId, fromDate, toDate, mode = "valuation" } = options;
  const prodIdStr = String(productId);
  let product = await db.products.get(prodIdStr);
  if (!product) {
    product = await db.products.filter((p: any) => p.id === prodIdStr || p._id === prodIdStr || String(p.id) === prodIdStr || String(p._id) === prodIdStr).first();
  }
  if (!product) return null;

  const valuationMethod = typeof window !== "undefined"
    ? (localStorage.getItem("setting_stockValuationMethod") || "average")
    : "average";

  const [batches, allPurchaseBills, allOrders, allSaleReturns, allAdjustments, allParties] = await Promise.all([
    db.inventory_batches.filter((b: any) => String(b.product_id) === prodIdStr || String(b.productId) === prodIdStr).toArray(),
    db.purchase_bills.toArray(),
    db.orders.toArray(),
    db.sale_return_transactions.toArray(),
    db.stock_adjustments.filter((a: any) => String(a.product_id) === prodIdStr || String(a.productId) === prodIdStr).toArray(),
    db.parties.toArray(),
  ]);

  const partyMap = new Map<string, string>();
  for (const p of allParties) {
    partyMap.set(String(p.id || (p as any)._id), p.company_name || p.name || "Party");
  }

  const rawMovements: any[] = [];

  // Opening Stock
  const openingBatch = batches.find(
    (b: any) => b.source_type === "opening_stock" || b.batch_number === "OPENING"
  );
  let initialOpeningQty = openingBatch
    ? Number(openingBatch.initial_quantity) || 0
    : Number((product as any).opening_stock || (product as any).initial_quantity || 0);
  const initialOpeningCost = openingBatch
    ? Number(openingBatch.cost_price) || 0
    : Number((product as any).initial_cost || (product as any).opening_cost || (product as any).purchase_price || product.cost_price || 0);
  // Find the earliest transaction or product created_at date (never default to 1970)
  const allTxDates: number[] = [];
  if ((product as any).created_at) allTxDates.push(new Date((product as any).created_at).getTime());
  if (openingBatch?.batch_date) allTxDates.push(new Date(openingBatch.batch_date).getTime());
  if (openingBatch?.created_at) allTxDates.push(new Date(openingBatch.created_at).getTime());
  for (const b of allPurchaseBills) allTxDates.push(new Date(b.bill_date || b.date || b.created_at).getTime());
  for (const o of allOrders) allTxDates.push(new Date(o.sale_date || o.date || o.created_at).getTime());
  for (const a of allAdjustments) allTxDates.push(new Date(a.date || a.adjustment_date || a.created_at).getTime());
  const validTxDates = allTxDates.filter(t => !isNaN(t) && t > 0);
  const earliestTx = validTxDates.length > 0 ? Math.min(...validTxDates) : Date.now();
  const openingDate = fromDate ? new Date(fromDate) : new Date(earliestTx);

  rawMovements.push({
    id: `opening-${prodIdStr}`,
    date: openingDate,
    type: "opening_stock",
    refNo: "OPENING",
    partyName: "Opening Stock",
    inwardQty: initialOpeningQty > 0 ? initialOpeningQty : 0,
    outwardQty: 0,
    unitRate: initialOpeningCost,
    costPrice: initialOpeningCost,
    totalAmount: Math.round(initialOpeningQty * initialOpeningCost * 100) / 100,
    batchNumber: "OPENING",
  });

  // Purchase Bills
  for (const bill of allPurchaseBills) {
    if (!Array.isArray(bill.items)) continue;
    const matched = bill.items.filter((it: any) => String(it.product_id) === prodIdStr);
    for (const it of matched) {
      const qty = Number(it.quantity) || 0;
      const rate = Number(it.cost_price ?? it.unit_price) || 0;
      const d = new Date(bill.bill_date || bill.date || bill.created_at || Date.now());
      rawMovements.push({
        id: `pb-${bill.id || (bill as any)._id}-${it.product_id}`,
        date: d,
        type: "purchase",
        refNo: bill.bill_number || `BILL-${String(bill.id || (bill as any)._id).slice(-6)}`,
        partyName: bill.party_name || partyMap.get(String(bill.party_id)) || "Supplier",
        inwardQty: qty,
        outwardQty: 0,
        unitRate: rate,
        costPrice: rate,
        totalAmount: Math.round(qty * rate * 100) / 100,
      });
    }
  }

  // Sales Orders
  for (const order of allOrders) {
    if (order.status === "cancelled" || !Array.isArray(order.items)) continue;
    const matched = order.items.filter((it: any) => String(it.product_id) === prodIdStr);
    for (const it of matched) {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.price) || 0;
      const costPrice = Number(it.cost_price ?? product.cost_price) || 0;
      const d = new Date(order.sale_date || order.date || order.created_at || Date.now());
      rawMovements.push({
        id: `so-${order.id || (order as any)._id}-${it.product_id}`,
        date: d,
        type: "sale",
        refNo: order.invoice_no || `INV-${String(order.id || (order as any)._id).slice(-6)}`,
        partyName: partyMap.get(String(order.customer_id || order.party_id)) || order.customer_name || "Customer",
        inwardQty: 0,
        outwardQty: qty,
        unitRate: price,
        costPrice: costPrice,
        totalAmount: Math.round(qty * price * 100) / 100,
      });
    }
  }

  // Sale Returns
  for (const ret of allSaleReturns) {
    if (!Array.isArray(ret.items)) continue;
    const matched = ret.items.filter((it: any) => String(it.productId || it.product_id) === prodIdStr);
    for (const it of matched) {
      const qty = Number(it.quantity) || 0;
      const rate = Number(it.rate) || 0;
      const d = new Date(ret.return_date || ret.date || ret.created_at || Date.now());
      rawMovements.push({
        id: `sr-${ret.id || (ret as any)._id}-${it.productId || it.product_id}`,
        date: d,
        type: "sale_return",
        refNo: ret.returnNumber || ret.return_number || `RET-${String(ret.id || (ret as any)._id).slice(-6)}`,
        partyName: partyMap.get(String(ret.customerId || ret.customer_id)) || "Customer",
        inwardQty: qty,
        outwardQty: 0,
        unitRate: rate,
        costPrice: Number(it.costPrice || product.cost_price || rate) || 0,
        totalAmount: Math.round(qty * rate * 100) / 100,
      });
    }
  }

  // Stock Adjustments
  for (const adj of allAdjustments) {
    const isAdd = adj.action_type === "add";
    const qty = Number(adj.quantity) || 0;
    const rate = Number(adj.cost_price || product.cost_price) || 0;
    const d = new Date(adj.date || adj.adjustment_date || adj.created_at || Date.now());
    rawMovements.push({
      id: `adj-${adj.id || (adj as any)._id}`,
      date: d,
      type: isAdd ? "adjustment_add" : "adjustment_reduce",
      refNo: adj.ref_no || `ADJ-${String(adj.id || (adj as any)._id).slice(-6)}`,
      partyName: `Adjustment (${adj.reason || "Manual"})`,
      inwardQty: isAdd ? qty : 0,
      outwardQty: !isAdd ? qty : 0,
      unitRate: rate,
      costPrice: rate,
      totalAmount: Math.round(qty * rate * 100) / 100,
    });
  }

  let reorderedMovements: any[] = [];

  if (mode === "valuation") {
    // WAC Valuation Sequence (Interleaved):
    // 1. Opening stock is ALWAYS row 1 at the very top.
    // 2. Inwards that occurred naturally prior to a sale are emitted first.
    // 3. For any sale where current stock is not enough (deficit), pull subsequent inwards
    //    until the sale's stock is covered.
    // 4. Then emit the sale immediately so it reflects the available stock & calculated WAC!
    // 5. Subsequent sales only run after their deficit has been covered by subsequent inwards.
    const buildInterleavedValuationSequence = (items: any[]): any[] => {
      const opening = items.find(m => m.type === "opening_stock");
      const otherMoves = items.filter(m => m.type !== "opening_stock");

      const inwardQueue = otherMoves
        .filter(m => (m.inwardQty || 0) > 0)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const outwardQueue = otherMoves
        .filter(m => (m.outwardQty || 0) > 0)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const result: any[] = [];
      let runningStock = 0;

      if (opening) {
        result.push(opening);
        runningStock += (opening.inwardQty || 0);
      }

      while (outwardQueue.length > 0) {
        const nextSale = outwardQueue[0];

        // 1. Emit inwards that occurred at or before this sale's timestamp
        while (inwardQueue.length > 0 && new Date(inwardQueue[0].date).getTime() <= new Date(nextSale.date).getTime()) {
          const naturalInward = inwardQueue.shift()!;
          result.push(naturalInward);
          runningStock += (naturalInward.inwardQty || 0);
        }

        // 2. If running stock is not enough for this sale, pull subsequent inwards until fulfilled
        while (runningStock < nextSale.outwardQty && inwardQueue.length > 0) {
          const deficitInward = inwardQueue.shift()!;
          result.push(deficitInward);
          runningStock += (deficitInward.inwardQty || 0);
        }

        // 3. Now emit the sale
        outwardQueue.shift();
        result.push(nextSale);
        runningStock -= nextSale.outwardQty;
      }

      // 4. Any remaining inwards at the end of the period
      while (inwardQueue.length > 0) {
        const remainingInward = inwardQueue.shift()!;
        result.push(remainingInward);
        runningStock += (remainingInward.inwardQty || 0);
      }

      return result;
    };

    reorderedMovements = buildInterleavedValuationSequence(rawMovements);
  } else {
    // Natural Chronological Sequence for Stock Movement Report (shows true physical minus balance when oversold):
    const opening = rawMovements.find(m => m.type === "opening_stock");
    const otherMoves = rawMovements.filter(m => m.type !== "opening_stock");

    const TYPE_PRIORITY: Record<string, number> = {
      purchase: 1,
      adjustment_add: 2,
      sale_return: 3,
      sale: 4,
      adjustment_reduce: 5,
    };

    otherMoves.sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      if (da !== db) return da - db;
      return (TYPE_PRIORITY[a.type] || 99) - (TYPE_PRIORITY[b.type] || 99);
    });

    reorderedMovements = opening ? [opening, ...otherMoves] : otherMoves;
  }

  let runningBalance = 0;
  let runningWac = initialOpeningCost > 0 ? initialOpeningCost : (Number(product.cost_price ?? product.purchase_price) || 0);
  let priorFulfilledBudget = 0;

  const allCalculatedMovements = reorderedMovements.map(m => {
    const prevBal = runningBalance;
    const prevWac = runningWac;
    let effectiveWac = runningWac;
    let wacFormula = "";

    if (m.type === "opening_stock") {
      runningBalance = Math.round((runningBalance + m.inwardQty) * 1000) / 1000;
      effectiveWac = m.unitRate > 0 ? m.unitRate : runningWac;
      runningWac = effectiveWac;
      wacFormula = m.inwardQty > 0 ? `Opening stock (${m.inwardQty}) @ ${effectiveWac}` : `Opening balance @ 0`;
    } else if (m.type === "purchase") {
      const inQty = m.inwardQty;
      const inRate = m.unitRate;
      if (prevBal < 0 && prevWac > 0) {
        effectiveWac = calculateMovingAverageWithPrior(prevBal, prevWac, inQty, inRate, priorFulfilledBudget);
        wacFormula = `Reconciled Deficit (${prevBal}) + Inward (${inQty} @ ${inRate}) -> WAC: ${effectiveWac}`;
      } else {
        effectiveWac = calculateMovingAverage(prevBal, prevWac, inQty, inRate);
        wacFormula = prevBal > 0 
          ? `(${prevBal} @ ${prevWac} + ${inQty} @ ${inRate}) / ${roundToPrecision(prevBal + inQty, 3)} = ${effectiveWac}`
          : `New inward @ ${inRate}`;
      }
      runningBalance = Math.round((runningBalance + inQty) * 1000) / 1000;
      runningWac = effectiveWac;
    } else if (m.type === "adjustment_add") {
      const inQty = m.inwardQty;
      const inRate = m.costPrice > 0 ? m.costPrice : prevWac;
      if (inRate > 0 && inRate !== prevWac) {
        effectiveWac = prevBal < 0
          ? calculateMovingAverageWithPrior(prevBal, prevWac, inQty, inRate, priorFulfilledBudget)
          : calculateMovingAverage(prevBal, prevWac, inQty, inRate);
        wacFormula = `Adj (+): (${prevBal} @ ${prevWac} + ${inQty} @ ${inRate}) -> WAC: ${effectiveWac}`;
        runningWac = effectiveWac;
      } else {
        effectiveWac = runningWac;
        wacFormula = `Adj (+): ${inQty} units (WAC maintained @ ${runningWac})`;
      }
      runningBalance = Math.round((runningBalance + inQty) * 1000) / 1000;
    } else if (m.type === "sale_return") {
      runningBalance = Math.round((runningBalance + m.inwardQty) * 1000) / 1000;
      effectiveWac = runningWac;
      wacFormula = `Sale Return (${m.inwardQty}) returned to inventory (WAC: ${runningWac})`;
    } else if (m.type === "sale") {
      const outQty = m.outwardQty;
      effectiveWac = runningWac;
      if (prevBal > 0) {
        priorFulfilledBudget += Math.min(prevBal, outQty);
      }
      runningBalance = Math.round((runningBalance - outQty) * 1000) / 1000;
      wacFormula = `Sale Outward: ${outQty} units @ COGS ${runningWac} (WAC maintained)`;
    } else if (m.type === "adjustment_reduce") {
      const outQty = m.outwardQty;
      effectiveWac = runningWac;
      runningBalance = Math.round((runningBalance - outQty) * 1000) / 1000;
      wacFormula = `Adj (-): ${outQty} units reduced (WAC maintained @ ${runningWac})`;
    }

    // Zoho Books rule: Asset value = runningBalance * effectiveWac (negative when stock is negative)
    const runningValuation = roundToPrecision(runningBalance * effectiveWac, 2);

    // Cost price & outward COGS
    const finalCostPrice = (m.type === "sale" || m.type === "adjustment_reduce")
      ? effectiveWac
      : (m.costPrice || m.unitRate || effectiveWac);

    const outwardCogs = (m.type === "sale" || m.type === "adjustment_reduce")
      ? roundToPrecision(m.outwardQty * effectiveWac, 2)
      : 0;

    return {
      ...m,
      date: m.date.toISOString(),
      costPrice: finalCostPrice,
      cogs: outwardCogs,
      balance: runningBalance,
      effectiveWac,
      runningValuation,
      wacFormula,
    };
  });

  let filteredMovements = allCalculatedMovements;
  let openingBalanceBeforeFilter = initialOpeningQty;

  if (fromDate || toDate) {
    const from = fromDate ? new Date(fromDate) : null;
    if (from) from.setHours(0, 0, 0, 0);
    const to = toDate ? new Date(toDate) : null;
    if (to) to.setHours(23, 59, 59, 999);

    let openingCostForPeriod = initialOpeningCost;

    if (from) {
      const priorMovements = allCalculatedMovements.filter(m => m.type !== "opening_stock" && new Date(m.date) < from);
      if (priorMovements.length > 0) {
        const lastPrior = priorMovements[priorMovements.length - 1];
        openingBalanceBeforeFilter = lastPrior.balance;
        openingCostForPeriod = Number(lastPrior.effectiveWac ?? initialOpeningCost) || initialOpeningCost;
      } else {
        openingBalanceBeforeFilter = initialOpeningQty;
        openingCostForPeriod = initialOpeningCost;
      }
    }

    filteredMovements = allCalculatedMovements.filter(m => {
      if (m.type === "opening_stock") return false;
      const d = new Date(m.date);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });

    const startPeriodDate = from ? from.toISOString() : (openingDate ? openingDate.toISOString() : new Date().toISOString());
    const openingValuationForPeriod = roundToPrecision(openingBalanceBeforeFilter * openingCostForPeriod, 2);

    filteredMovements.unshift({
      id: `opening-period-${startPeriodDate}`,
      date: startPeriodDate,
      type: "opening_stock",
      refNo: "OPENING",
      partyName: "Opening Stock",
      inwardQty: openingBalanceBeforeFilter > 0 ? openingBalanceBeforeFilter : 0,
      outwardQty: openingBalanceBeforeFilter < 0 ? Math.abs(openingBalanceBeforeFilter) : 0,
      unitRate: openingCostForPeriod,
      costPrice: openingCostForPeriod,
      cogs: 0,
      totalAmount: Math.abs(openingValuationForPeriod),
      balance: openingBalanceBeforeFilter,
      effectiveWac: openingCostForPeriod,
      runningValuation: openingValuationForPeriod,
      wacFormula: openingBalanceBeforeFilter !== 0 ? `Opening balance B/F @ ${openingCostForPeriod}` : `Opening balance @ 0`,
    });
  }

  let periodInward = 0;
  let periodOutward = 0;
  for (const m of filteredMovements) {
    if (m.type !== "opening_stock") {
      periodInward += m.inwardQty;
      periodOutward += m.outwardQty;
    }
  }

  const curCost = Number(product.cost_price ?? product.purchase_price) || 0;
  const curStock = parseFloat(product.quantity?.toString() || product.in_stock?.toString() || "0");

  const trueClosingWac = allCalculatedMovements.length > 0
    ? allCalculatedMovements[allCalculatedMovements.length - 1].effectiveWac
    : curCost;

  // Self-healing synchronization:
  // Ensure product master's cost_price in Dexie db.products stays 100% in sync with true closing WAC!
  if (trueClosingWac > 0 && Math.abs(curCost - trueClosingWac) > 0.001) {
    db.products.update(prodIdStr, {
      cost_price: trueClosingWac,
      cost_price_str: trueClosingWac.toString(),
      purchase_price: trueClosingWac,
    }).catch(err => console.error("Failed to sync closing WAC to Dexie product:", err));
  }

  const effectiveCost = trueClosingWac > 0 ? trueClosingWac : curCost;
  const totalInventoryValuation = curStock > 0 ? Math.round(curStock * effectiveCost * 100) / 100 : 0;

  return {
    product: {
      id: prodIdStr,
      name: product.name,
      sku: product.sku || "-",
      category: product.category || "General",
      branch: product.branch || "Main",
      uom: product.unit_of_measurement || "pcs",
      currentStock: curStock,
      costPrice: effectiveCost,
      totalValuation: totalInventoryValuation,
      sellPrice: Number(product.sell_price) || 0,
      valuationMethod,
    },
    summary: {
      openingStock: openingBalanceBeforeFilter,
      totalInward: Math.round(periodInward * 1000) / 1000,
      totalOutward: Math.round(periodOutward * 1000) / 1000,
      closingStock: filteredMovements.length > 0 
        ? filteredMovements[filteredMovements.length - 1].balance 
        : openingBalanceBeforeFilter,
      closingWac: filteredMovements.length > 0
        ? filteredMovements[filteredMovements.length - 1].effectiveWac
        : curCost,
      closingValuation: filteredMovements.length > 0
        ? filteredMovements[filteredMovements.length - 1].runningValuation
        : totalInventoryValuation,
      valuationMethod,
      activeBatchesCount: batches.filter((b: any) => b.status === "active" && Number(b.remaining_quantity) > 0).length,
    },
    batches: batches.map((b: any) => ({
      id: String(b.id || b._id),
      batch_number: b.batch_number || "BATCH",
      source_type: b.source_type || "purchase_bill",
      initial_quantity: Number(b.initial_quantity) || 0,
      remaining_quantity: Number(b.remaining_quantity) || 0,
      cost_price: Number(b.cost_price) || 0,
      status: b.status || "active",
      batch_date: b.batch_date || b.created_at || new Date().toISOString(),
    })),
    movements: filteredMovements,
  };
}


