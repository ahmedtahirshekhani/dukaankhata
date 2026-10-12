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
