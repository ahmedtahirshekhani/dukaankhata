/**
 * Pure calculation utilities for Inventory Valuation.
 * Safe to import in both client-side (browser/Dexie) and server-side environments.
 * DO NOT import any server-only modules (like mongodb, fs, net) in this file.
 */

// Precision helper to prevent JS floating point issues (defaults to 2 decimals for currency)
export const roundToPrecision = (num: number, decimals: number = 2): number => {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
};

/**
 * Calculates the new moving weighted average cost price on inward purchases.
 * 
 * Formula:
 * New Cost = ((Current Qty * Current Cost) + (New Purchase Qty * New Purchase Cost)) / (Current Qty + New Purchase Qty)
 * 
 * Note: If current quantity <= 0 (out of stock or negative stock), the new purchase rate becomes the cost price.
 */
export function calculateMovingAverage(
  currentQty: number,
  currentCost: number,
  newQty: number,
  newCost: number
): number {
  const cQty = parseFloat(currentQty?.toString() || "0");
  const cCost = parseFloat(currentCost?.toString() || "0");
  const nQty = parseFloat(newQty?.toString() || "0");
  const nCost = parseFloat(newCost?.toString() || "0");

  if (nQty <= 0) return roundToPrecision(cCost, 2);

  // If current stock is 0 or negative, set directly to the new purchase rate
  if (cQty <= 0) {
    return roundToPrecision(nCost, 2);
  }

  const totalQty = cQty + nQty;
  if (totalQty <= 0) {
    return roundToPrecision(nCost, 2);
  }

  const totalValue = (cQty * cCost) + (nQty * nCost);
  const averageCost = totalValue / totalQty;

  return roundToPrecision(averageCost, 2);
}
