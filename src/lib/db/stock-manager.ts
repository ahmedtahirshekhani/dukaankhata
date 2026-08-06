import { getCollection, COLLECTIONS, toObjectId } from '@/lib/db/mongodb';

// Precision handle karne ke liye (e.g., 0.1 + 0.2 ka javascript bug handle karne ke liye)
const roundToPrecision = (num: number, decimals: number = 5) => {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
};

export async function adjustStock(
  productId: string | number | undefined | null, 
  userId: string, 
  qtyChange: number // Positive for addition (purchase/return), negative for deduction (sale)
) {
  if (!productId || productId === "0" || qtyChange === 0) return;
  
  const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
  const prodIdStr = String(productId);
  
  if (prodIdStr.match(/^[0-9a-fA-F]{24}$/)) {
    const product = await productsCollection.findOne({ _id: toObjectId(prodIdStr), user_id: toObjectId(userId) });
    
    if (product) {
      const currentQty = parseFloat(product.quantity?.toString() || product.in_stock?.toString() || "0");
      const newQty = roundToPrecision(currentQty + parseFloat(qtyChange.toString()));
      
      await productsCollection.updateOne(
        { _id: toObjectId(prodIdStr), user_id: toObjectId(userId) },
        { 
          $set: { 
            quantity: newQty,
            quantity_str: newQty.toString(),
            in_stock: newQty,
            updated_at: new Date()
          }
        }
      );
    }
  }
}
