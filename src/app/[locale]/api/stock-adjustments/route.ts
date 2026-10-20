import { NextRequest, NextResponse } from "next/server";
import {
  getCollection,
  COLLECTIONS,
  toObjectId,
  isValidObjectId,
} from "@/lib/db/mongodb";
import { getCurrentUser } from "@/lib/auth/utils";
import { requirePermission } from "@/lib/auth/rbac";
import {
  getValuationMethod,
  calculateMovingAverage,
  roundToPrecision,
  consumeBatchesOnSaleServer,
  reconcileUnfulfilledSalesForProduct,
  reconcileUnfulfilledSalesForProductAverage,
} from "@/lib/inventory/valuation-engine";

export async function POST(request: NextRequest) {
  try {
    const user = (await getCurrentUser()) as { id: string } | null;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Permission check
    const authCheck = await requirePermission("products.edit");
    if (!authCheck.allowed) return authCheck.response!;

    const body = await request.json();
    const {
      productId,
      stockType = "available",
      actionType = "add",
      quantity,
      reason,
      notes = "",
      adjustmentDate,
      costPrice,
    } = body;

    if (!productId || !isValidObjectId(productId)) {
      return NextResponse.json(
        { error: "Valid productId is required" },
        { status: 400 }
      );
    }

    const numQty = parseFloat(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      return NextResponse.json(
        { error: "Quantity must be greater than zero" },
        { status: 400 }
      );
    }

    const userId = toObjectId(user.id);
    const prodObjId = toObjectId(productId);
    const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);

    const product = await productsCollection.findOne({
      _id: prodObjId,
      user_id: userId,
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const curQty = parseFloat(
      product.quantity?.toString() || product.in_stock?.toString() || "0"
    );
    const curDamaged = parseFloat(product.damaged_quantity?.toString() || "0");
    const curCost = parseFloat(
      product.cost_price?.toString() || product.purchase_price?.toString() || "0"
    );
    const resolvedCost =
      typeof costPrice === "number" && costPrice >= 0 ? costPrice : curCost;

    let newQty = curQty;
    let newDamaged = curDamaged;
    const valuationMethod = await getValuationMethod(user.id);
    const batchesCollection = await getCollection(COLLECTIONS.INVENTORY_BATCHES);

    const updateFields: any = {
      updated_at: new Date(),
    };

    const parsedDate = adjustmentDate ? new Date(adjustmentDate) : new Date();

    if (stockType === "damaged") {
      newDamaged =
        actionType === "add"
          ? roundToPrecision(curDamaged + numQty, 5)
          : Math.max(0, roundToPrecision(curDamaged - numQty, 5));

      updateFields.damaged_quantity = newDamaged;
      updateFields.damaged_quantity_str = newDamaged.toString();
    } else {
      // Main available stock
      if (actionType === "add") {
        newQty = roundToPrecision(curQty + numQty, 5);
        updateFields.quantity = newQty;
        updateFields.quantity_str = newQty.toString();
        updateFields.in_stock = newQty;

        if (valuationMethod === "average" && resolvedCost > 0) {
          let newAvgCost = resolvedCost;
          if (curQty > 0 && curCost > 0) {
            newAvgCost = calculateMovingAverage(curQty, curCost, numQty, resolvedCost);
          }
          updateFields.cost_price = newAvgCost;
          updateFields.cost_price_str = newAvgCost.toString();
          updateFields.purchase_price = newAvgCost;

          await reconcileUnfulfilledSalesForProductAverage({
            userId: user.id,
            productId: String(productId),
            costPrice: newAvgCost,
          });
        } else if (valuationMethod === "fifo") {
          await batchesCollection.insertOne({
            user_id: userId,
            product_id: prodObjId,
            source_type: "stock_adjustment",
            source_id: `adj_${Date.now()}`,
            batch_number: `ADJ-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}`,
            initial_quantity: numQty,
            remaining_quantity: numQty,
            cost_price: resolvedCost,
            status: "active",
            batch_date: parsedDate,
            created_at: new Date(),
            updated_at: new Date(),
          });

          await reconcileUnfulfilledSalesForProduct({
            userId: user.id,
            productId: String(productId),
          });
        }
      } else {
        // actionType === "reduce"
        newQty = Math.max(0, roundToPrecision(curQty - numQty, 5));
        updateFields.quantity = newQty;
        updateFields.quantity_str = newQty.toString();
        updateFields.in_stock = newQty;

        if (valuationMethod === "fifo") {
          await consumeBatchesOnSaleServer({
            userId: user.id,
            productId: String(productId),
            saleQty: numQty,
            fallbackCostPrice: curCost,
          });
        }
      }
    }

    await productsCollection.updateOne(
      { _id: prodObjId, user_id: userId },
      { $set: updateFields }
    );

    // Save adjustment log to stock_adjustments collection
    const stockAdjustmentsCollection = await getCollection(
      (COLLECTIONS as any).STOCK_ADJUSTMENTS || "stock_adjustments"
    );

    const refNo = `ADJ-${Date.now().toString().slice(-6)}`;
    await stockAdjustmentsCollection.insertOne({
      user_id: userId,
      product_id: prodObjId,
      product_name: product.name,
      stock_type: stockType,
      action_type: actionType,
      quantity: numQty,
      cost_price: resolvedCost,
      reason: reason || "physicalCount",
      notes: notes || "",
      ref_no: refNo,
      date: parsedDate,
      created_at: new Date(),
    });

    return NextResponse.json({
      success: true,
      newQuantity: newQty,
      newDamagedQuantity: newDamaged,
      refNo,
    });
  } catch (err: any) {
    console.error("Error creating stock adjustment:", err);
    return NextResponse.json(
      { error: err.message || "Failed to adjust stock" },
      { status: 500 }
    );
  }
}
