import { db } from "@/lib/db/offline-db";
import { calculateMovingAverage } from "@/lib/inventory/valuation-calc";

const roundToPrecision = (num: number, decimals: number = 5) => {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
};

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
    if (valuationMethod === "average") {
      const newAverageCost = calculateMovingAverage(currentQty, currentCost, qtyChange, unitCostPrice);
      updateFields.cost_price = newAverageCost;
      updateFields.cost_price_str = newAverageCost.toString();
      updateFields.purchase_price = newAverageCost;
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
      if (remainingBatches.length > 0) {
        if (valuationMethod === "fifo") {
          remainingBatches.sort((a: any, b: any) => new Date(b.batch_date).getTime() - new Date(a.batch_date).getTime());
          const latestCost = Number(remainingBatches[0].cost_price) || 0;
          updateFields.cost_price = latestCost;
          updateFields.cost_price_str = latestCost.toString();
          updateFields.purchase_price = latestCost;
        } else if (valuationMethod === "average") {
          let totalVal = 0;
          let totalRemQty = 0;
          for (const b of remainingBatches) {
            const bQty = Number(b.remaining_quantity ?? b.initial_quantity) || 0;
            totalVal += bQty * Number(b.cost_price || 0);
            totalRemQty += bQty;
          }
          if (totalRemQty > 0) {
            const restoredAvg = roundToPrecision(totalVal / totalRemQty, 4);
            updateFields.cost_price = restoredAvg;
            updateFields.cost_price_str = restoredAvg.toString();
            updateFields.purchase_price = restoredAvg;
          }
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
  } catch (err) {
    console.error("Failed to save offline sale return batch:", err);
  }
}
