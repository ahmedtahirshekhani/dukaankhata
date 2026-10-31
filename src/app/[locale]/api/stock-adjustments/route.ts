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

    const isCostPriceExplicitlyChanged =
      typeof costPrice === "number" && costPrice >= 0 && (costPrice !== curCost || curCost <= 0);

    let newQty = curQty;
    let newDamaged = curDamaged;
    let reductionCost = curCost;
    let consumedBatchSplits: any[] = [];
    let batchInsertResult: any = null;
    const valuationMethod = await getValuationMethod(user.id);
    const batchesCollection = await getCollection(COLLECTIONS.INVENTORY_BATCHES);

    const updateFields: any = {
      updated_at: new Date(),
    };

    const parsedDate = adjustmentDate ? new Date(adjustmentDate) : new Date();
    const refNo = body.refNo || body.ref_no || `ADJ-${Date.now().toString().slice(-6)}`;
    const adjLocalId = body.localId || `adj_${Date.now()}`;

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

        if (valuationMethod === "fifo") {
          batchInsertResult = await batchesCollection.insertOne({
            user_id: userId,
            product_id: prodObjId,
            source_type: "stock_adjustment",
            source_id: adjLocalId,
            batch_number: refNo,
            initial_quantity: numQty,
            remaining_quantity: numQty,
            cost_price: resolvedCost,
            status: "active",
            batch_date: parsedDate,
            created_at: new Date(),
            updated_at: new Date(),
          });

          if (resolvedCost > 0) {
            updateFields.cost_price = resolvedCost;
            updateFields.cost_price_str = resolvedCost.toString();
            updateFields.purchase_price = resolvedCost;
          }

          await reconcileUnfulfilledSalesForProduct({
            userId: user.id,
            productId: String(productId),
          });
        } else if (valuationMethod === "average") {
          // If user explicitly changed the cost price in the dialog, calculate moving average
          if (isCostPriceExplicitlyChanged && resolvedCost > 0) {
            const { getServerPriorFulfilledQty } = await import('@/lib/inventory/valuation-engine');
            let priorFulfilledQty = 0;
            if (curQty < 0) {
              priorFulfilledQty = await getServerPriorFulfilledQty(user.id, String(productId));
            }
            const { calculateMovingAverageWithPrior } = await import('@/lib/inventory/valuation-calc');
            const newAvgCost = calculateMovingAverageWithPrior(curQty, curCost, numQty, resolvedCost, priorFulfilledQty);
            updateFields.cost_price = newAvgCost;
            updateFields.cost_price_str = newAvgCost.toString();
            updateFields.purchase_price = newAvgCost;

            await reconcileUnfulfilledSalesForProductAverage({
              userId: user.id,
              productId: String(productId),
              costPrice: newAvgCost,
              inwardQty: numQty,
            });
          }
        }
      } else {
        // actionType === "reduce"
        newQty = Math.max(0, roundToPrecision(curQty - numQty, 5));
        updateFields.quantity = newQty;
        updateFields.quantity_str = newQty.toString();
        updateFields.in_stock = newQty;

        if (valuationMethod === "fifo") {
          const consumption = await consumeBatchesOnSaleServer({
            userId: user.id,
            productId: String(productId),
            saleQty: numQty,
            fallbackCostPrice: curCost,
          });
          if (consumption && consumption.effective_unit_cost > 0) {
            reductionCost = consumption.effective_unit_cost;
            consumedBatchSplits = consumption.consumed_batches || [];
          }
        } else {
          reductionCost = curCost;
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

    const finalAdjCost = actionType === "reduce" ? reductionCost : resolvedCost;
    const insertResult = await stockAdjustmentsCollection.insertOne({
      user_id: userId,
      product_id: prodObjId,
      product_name: product.name,
      stock_type: stockType,
      action_type: actionType,
      quantity: numQty,
      cost_price: finalAdjCost,
      batch_splits: consumedBatchSplits,
      previous_cost_price: curCost,
      previous_quantity: curQty,
      reason: reason || "physicalCount",
      notes: notes || "",
      ref_no: refNo,
      date: parsedDate,
      metadata: { local_id: adjLocalId },
      created_at: new Date(),
    });

    const newId = insertResult.insertedId.toString();

    if (batchInsertResult?.insertedId) {
      await batchesCollection.updateOne(
        { _id: batchInsertResult.insertedId },
        { $set: { source_id: newId } }
      );
    }

    return NextResponse.json({
      success: true,
      id: newId,
      _id: newId,
      newQuantity: newQty,
      newDamagedQuantity: newDamaged,
      newCostPrice: actionType === "reduce" ? curCost : finalAdjCost,
      effectiveCostPrice: finalAdjCost,
      batch_splits: consumedBatchSplits,
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

export async function GET(request: NextRequest) {
  try {
    const user = (await getCurrentUser()) as { id: string } | null;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const stockType = searchParams.get("stockType");
    const actionType = searchParams.get("actionType");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const userId = toObjectId(user.id);
    const stockAdjustmentsCollection = await getCollection(COLLECTIONS.STOCK_ADJUSTMENTS);

    const query: any = { user_id: userId };

    if (productId && isValidObjectId(productId)) {
      query.product_id = toObjectId(productId);
    }
    if (stockType && stockType !== "all") {
      query.stock_type = stockType;
    }
    if (actionType && actionType !== "all") {
      query.action_type = actionType;
    }
    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) {
        const from = new Date(fromDate);
        from.setHours(0, 0, 0, 0);
        query.date.$gte = from;
      }
      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        query.date.$lte = to;
      }
    }
    if (search) {
      const s = search.trim();
      query.$or = [
        { product_name: { $regex: s, $options: "i" } },
        { ref_no: { $regex: s, $options: "i" } },
        { reason: { $regex: s, $options: "i" } },
        { notes: { $regex: s, $options: "i" } },
      ];
    }

    const totalCount = await stockAdjustmentsCollection.countDocuments(query);
    const skip = limit === -1 ? 0 : (page - 1) * limit;

    let cursor = stockAdjustmentsCollection
      .find(query)
      .sort({ date: -1, created_at: -1 });

    if (limit !== -1) {
      cursor = cursor.skip(skip).limit(limit);
    }

    const rawAdjustments = await cursor.toArray();

    // Map _id and dates to clean strings
    const adjustments = rawAdjustments.map((a: any) => ({
      id: a._id.toString(),
      product_id: a.product_id?.toString(),
      product_name: a.product_name || "Unknown Product",
      stock_type: a.stock_type || "available",
      action_type: a.action_type || "add",
      quantity: Number(a.quantity) || 0,
      cost_price: Number(a.cost_price) || 0,
      reason: a.reason || "physicalCount",
      notes: a.notes || "",
      ref_no: a.ref_no || `ADJ-${a._id.toString().slice(-6)}`,
      date: a.date ? new Date(a.date).toISOString() : new Date(a.created_at || Date.now()).toISOString(),
      created_at: a.created_at ? new Date(a.created_at).toISOString() : new Date().toISOString(),
    }));

    // Compute summaries
    let totalAdded = 0;
    let totalReduced = 0;
    let totalCostValue = 0;

    for (const a of adjustments) {
      const q = Number(a.quantity) || 0;
      const c = Number(a.cost_price) || 0;
      if (a.action_type === "add") {
        totalAdded += q;
        totalCostValue += q * c;
      } else {
        totalReduced += q;
        totalCostValue -= q * c;
      }
    }

    return NextResponse.json({
      adjustments,
      totalCount,
      totalPages: limit === -1 ? 1 : Math.ceil(totalCount / limit) || 1,
      currentPage: page,
      summary: {
        totalAdded: Math.round(totalAdded * 1000) / 1000,
        totalReduced: Math.round(totalReduced * 1000) / 1000,
        totalCostValue: Math.round(totalCostValue * 100) / 100,
      },
    });
  } catch (err: any) {
    console.error("Error fetching stock adjustments:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch stock adjustments" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = (await getCurrentUser()) as { id: string } | null;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requirePermission("products.edit");
    if (!authCheck.allowed) return authCheck.response!;

    const { searchParams } = new URL(request.url);
    let id = searchParams.get("id");
    let productId = searchParams.get("productId");

    if (!id) {
      try {
        const body = await request.json();
        id = body.id;
        productId = body.productId || productId;
      } catch {
        // query param only
      }
    }

    if (!id) {
      return NextResponse.json({ error: "Adjustment ID is required" }, { status: 400 });
    }

    const userId = toObjectId(user.id);
    const stockAdjustmentsCollection = await getCollection(COLLECTIONS.STOCK_ADJUSTMENTS);
    const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
    const batchesCollection = await getCollection(COLLECTIONS.INVENTORY_BATCHES);

    let query: any = { user_id: userId };
    if (isValidObjectId(id)) {
      query._id = toObjectId(id);
    } else {
      query.$or = [{ id }, { ref_no: id }, { "metadata.local_id": id }];
    }

    const adj = await stockAdjustmentsCollection.findOne(query);
    if (!adj) {
      return NextResponse.json({ error: "Stock adjustment not found" }, { status: 404 });
    }

    const prodId = adj.product_id;
    const product = await productsCollection.findOne({ _id: toObjectId(prodId.toString()), user_id: userId });

    let newQty = 0;
    let newDamaged = 0;
    let newCost = 0;

    if (product) {
      const curQty = parseFloat(product.quantity?.toString() || product.in_stock?.toString() || "0");
      const curDamaged = parseFloat(product.damaged_quantity?.toString() || "0");
      const curCost = parseFloat(product.cost_price?.toString() || product.purchase_price?.toString() || "0");
      const adjQty = Number(adj.quantity) || 0;
      const adjCost = Number(adj.cost_price ?? curCost) || 0;

      const valuationMethod = await getValuationMethod(user.id);

      newQty = curQty;
      newDamaged = curDamaged;
      newCost = curCost;

      const updateFields: any = {
        updated_at: new Date(),
      };

      if (adj.stock_type === "damaged") {
        newDamaged = adj.action_type === "add"
          ? Math.max(0, roundToPrecision(curDamaged - adjQty, 5))
          : roundToPrecision(curDamaged + adjQty, 5);
        updateFields.damaged_quantity = newDamaged;
        updateFields.damaged_quantity_str = newDamaged.toString();
      } else {
        if (adj.action_type === "add") {
          newQty = roundToPrecision(curQty - adjQty, 5);
          updateFields.quantity = newQty;
          updateFields.quantity_str = newQty.toString();
          updateFields.in_stock = newQty;

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
              // Case 3: Stock was positive (curQty > 0), but deleting this adjustment pushed it into zero or deficit (prevQty <= 0).
              // Check if any newer transactions (purchase bills or adjustments) happened on or after this adjustment:
              const adjDate = new Date(adj.date || adj.created_at || 0);
              const adjCreatedAt = new Date(adj.created_at || adj.date || 0);
              let hasSubsequentInward = false;
              try {
                const purchaseBillsCollection = await getCollection(COLLECTIONS.PURCHASE_BILLS);
                // 1. Newer stock adjustment on subsequent date or same date later time
                const newerAdj = await stockAdjustmentsCollection.findOne({
                  user_id: userId,
                  product_id: toObjectId(prodId.toString()),
                  _id: { $ne: adj._id },
                  $or: [
                    { date: { $gt: adjDate } },
                    { date: adjDate, created_at: { $gt: adjCreatedAt } }
                  ]
                });
                if (newerAdj) {
                  hasSubsequentInward = true;
                } else {
                  // 2. Newer purchase bill on subsequent date or same date later time
                  const newerBill = await purchaseBillsCollection.findOne({
                    user_id: userId,
                    "items.product_id": toObjectId(prodId.toString()),
                    $or: [
                      { date: { $gt: adjDate } },
                      { date: adjDate, created_at: { $gt: adjCreatedAt } }
                    ]
                  });
                  if (newerBill) hasSubsequentInward = true;
                }
              } catch {
                hasSubsequentInward = false;
              }

              if (!hasSubsequentInward && adj.previous_cost_price !== undefined && adj.previous_cost_price !== null && Number(adj.previous_cost_price) > 0) {
                const restored = Number(adj.previous_cost_price);
                newCost = restored;
                updateFields.cost_price = restored;
                updateFields.cost_price_str = restored.toString();
                updateFields.purchase_price = restored;
              } else {
                newCost = curCost;
              }
            }
          } else if (valuationMethod === "fifo") {
            const remainingBatches = await batchesCollection
              .find({
                user_id: userId,
                product_id: toObjectId(prodId.toString()),
                status: "active",
                source_id: { $nin: [adj._id.toString(), adj.ref_no, id] }
              })
              .sort({ batch_date: -1 })
              .toArray();

            if (remainingBatches.length > 0) {
              const latestCost = Number(remainingBatches[0].cost_price) || 0;
              if (latestCost > 0) {
                newCost = latestCost;
                updateFields.cost_price = latestCost;
                updateFields.cost_price_str = latestCost.toString();
                updateFields.purchase_price = latestCost;
              }
            }
          }
        } else {
          newQty = roundToPrecision(curQty + adjQty, 5);
          updateFields.quantity = newQty;
          updateFields.quantity_str = newQty.toString();
          updateFields.in_stock = newQty;

          if (valuationMethod === "fifo" && adj.batch_splits && Array.isArray(adj.batch_splits) && adj.batch_splits.length > 0) {
            const { restoreBatchesOnSaleRevertServer } = await import('@/lib/inventory/valuation-engine');
            await restoreBatchesOnSaleRevertServer({
              userId: user.id,
              consumedBatches: adj.batch_splits,
            });
          }
        }
      }

      await productsCollection.updateOne(
        { _id: toObjectId(prodId.toString()), user_id: userId },
        { $set: updateFields }
      );

      await batchesCollection.deleteMany({
        user_id: userId,
        product_id: toObjectId(prodId.toString()),
        $or: [
          { source_id: adj._id.toString() },
          { source_id: adj.ref_no },
          { source_id: id },
          { batch_number: adj.ref_no },
        ]
      });
    }

    await stockAdjustmentsCollection.deleteOne({ _id: adj._id });

    return NextResponse.json({
      success: true,
      newQuantity: newQty,
      newDamagedQuantity: newDamaged,
      newCostPrice: newCost,
    });
  } catch (err: any) {
    console.error("Error deleting stock adjustment:", err);
    return NextResponse.json(
      { error: err.message || "Failed to delete stock adjustment" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = (await getCurrentUser()) as { id: string } | null;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requirePermission("products.edit");
    if (!authCheck.allowed) return authCheck.response!;

    const body = await request.json();
    const {
      id,
      productId,
      stockType = "available",
      actionType = "add",
      quantity,
      costPrice,
      reason,
      notes = "",
      adjustmentDate,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Adjustment ID is required" }, { status: 400 });
    }

    const numQty = parseFloat(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      return NextResponse.json({ error: "Quantity must be greater than zero" }, { status: 400 });
    }

    const userId = toObjectId(user.id);
    const stockAdjustmentsCollection = await getCollection(COLLECTIONS.STOCK_ADJUSTMENTS);
    const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
    const batchesCollection = await getCollection(COLLECTIONS.INVENTORY_BATCHES);

    let query: any = { user_id: userId };
    if (isValidObjectId(id)) {
      query._id = toObjectId(id);
    } else {
      query.$or = [{ id }, { ref_no: id }, { "metadata.local_id": id }];
    }

    const oldAdj = await stockAdjustmentsCollection.findOne(query);
    if (!oldAdj) {
      return NextResponse.json({ error: "Stock adjustment not found" }, { status: 404 });
    }

    const prodObjId = toObjectId((productId || oldAdj.product_id).toString());
    const product = await productsCollection.findOne({ _id: prodObjId, user_id: userId });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const valuationMethod = await getValuationMethod(user.id);

    let curQty = parseFloat(product.quantity?.toString() || product.in_stock?.toString() || "0");
    let curDamaged = parseFloat(product.damaged_quantity?.toString() || "0");
    let curCost = parseFloat(product.cost_price?.toString() || product.purchase_price?.toString() || "0");

    // 1. Revert old adjustment
    const oldQty = Number(oldAdj.quantity) || 0;
    const oldCost = Number(oldAdj.cost_price ?? curCost) || 0;

    if (oldAdj.stock_type === "damaged") {
      curDamaged = oldAdj.action_type === "add"
        ? Math.max(0, roundToPrecision(curDamaged - oldQty, 5))
        : roundToPrecision(curDamaged + oldQty, 5);
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
          } else {
            // Reverting pushes stock into deficit/zero: check subsequent inwards (adjustments or bills)
            const oldDate = new Date(oldAdj.date || oldAdj.created_at || 0);
            const oldCreatedAt = new Date(oldAdj.created_at || oldAdj.date || 0);
            let hasSubsequentInward = false;
            try {
              const purchaseBillsCollection = await getCollection(COLLECTIONS.PURCHASE_BILLS);
              // 1. Check newer stock adjustments
              const newerAdj = await stockAdjustmentsCollection.findOne({
                user_id: userId,
                product_id: prodObjId,
                _id: { $ne: oldAdj._id },
                $or: [
                  { date: { $gt: oldDate } },
                  { date: oldDate, created_at: { $gt: oldCreatedAt } }
                ]
              });
              if (newerAdj) {
                hasSubsequentInward = true;
              } else {
                // 2. Check newer purchase bills
                const newerBill = await purchaseBillsCollection.findOne({
                  user_id: userId,
                  "items.product_id": prodObjId,
                  $or: [
                    { date: { $gt: oldDate } },
                    { date: oldDate, created_at: { $gt: oldCreatedAt } }
                  ]
                });
                if (newerBill) hasSubsequentInward = true;
              }
            } catch {
              hasSubsequentInward = false;
            }

            if (!hasSubsequentInward && oldAdj.previous_cost_price !== undefined && oldAdj.previous_cost_price !== null && Number(oldAdj.previous_cost_price) > 0) {
              curCost = Number(oldAdj.previous_cost_price);
            }
          }
        }
        curQty = roundToPrecision(curQty - oldQty, 5);
      } else {
        curQty = roundToPrecision(curQty + oldQty, 5);
        if (valuationMethod === "fifo" && oldAdj.batch_splits && Array.isArray(oldAdj.batch_splits) && oldAdj.batch_splits.length > 0) {
          const { restoreBatchesOnSaleRevertServer } = await import('@/lib/inventory/valuation-engine');
          await restoreBatchesOnSaleRevertServer({
            userId: user.id,
            consumedBatches: oldAdj.batch_splits,
          });
        }
      }
    }

    // Clean up old batches
    await batchesCollection.deleteMany({
      user_id: userId,
      product_id: prodObjId,
      $or: [
        { source_id: oldAdj._id.toString() },
        { source_id: oldAdj.ref_no },
        { source_id: id },
        { batch_number: oldAdj.ref_no },
      ]
    });

    // 2. Apply new adjustment on intermediate reverted stock & cost
    const resolvedCost = typeof costPrice === "number" && costPrice >= 0 ? costPrice : curCost;
    let finalQty = curQty;
    let finalDamaged = curDamaged;
    let finalCost = curCost;
    let reductionCost = curCost;
    let consumedBatchSplits: any[] = [];

    const updateFields: any = { updated_at: new Date() };
    const parsedDate = adjustmentDate ? new Date(adjustmentDate) : new Date();

    if (stockType === "damaged") {
      finalDamaged = actionType === "add"
        ? roundToPrecision(curDamaged + numQty, 5)
        : Math.max(0, roundToPrecision(curDamaged - numQty, 5));
      updateFields.damaged_quantity = finalDamaged;
      updateFields.damaged_quantity_str = finalDamaged.toString();
    } else {
      if (actionType === "add") {
        finalQty = roundToPrecision(curQty + numQty, 5);
        updateFields.quantity = finalQty;
        updateFields.quantity_str = finalQty.toString();
        updateFields.in_stock = finalQty;

        if (valuationMethod === "fifo") {
          await batchesCollection.insertOne({
            user_id: userId,
            product_id: prodObjId,
            source_type: "stock_adjustment",
            source_id: oldAdj._id.toString(),
            batch_number: oldAdj.ref_no || body.refNo || body.ref_no || `ADJ-${Date.now().toString().slice(-6)}`,
            initial_quantity: numQty,
            remaining_quantity: numQty,
            cost_price: resolvedCost,
            status: "active",
            batch_date: parsedDate,
            created_at: new Date(),
            updated_at: new Date(),
          });
          if (resolvedCost > 0) {
            finalCost = resolvedCost;
            updateFields.cost_price = resolvedCost;
            updateFields.cost_price_str = resolvedCost.toString();
            updateFields.purchase_price = resolvedCost;
          }
          await reconcileUnfulfilledSalesForProduct({ userId: user.id, productId: prodObjId.toString() });
        } else if (valuationMethod === "average") {
          const { getServerPriorFulfilledQty } = await import('@/lib/inventory/valuation-engine');
          let priorFulfilledQty = 0;
          if (curQty < 0) {
            priorFulfilledQty = await getServerPriorFulfilledQty(user.id, prodObjId.toString());
          }
          const { calculateMovingAverageWithPrior } = await import('@/lib/inventory/valuation-calc');
          const newAvgCost = calculateMovingAverageWithPrior(curQty, curCost, numQty, resolvedCost, priorFulfilledQty);
          finalCost = newAvgCost;
          updateFields.cost_price = newAvgCost;
          updateFields.cost_price_str = newAvgCost.toString();
          updateFields.purchase_price = newAvgCost;
          await reconcileUnfulfilledSalesForProductAverage({
            userId: user.id,
            productId: prodObjId.toString(),
            costPrice: newAvgCost,
            inwardQty: numQty,
          });
        }
      } else {
        finalQty = Math.max(0, roundToPrecision(curQty - numQty, 5));
        updateFields.quantity = finalQty;
        updateFields.quantity_str = finalQty.toString();
        updateFields.in_stock = finalQty;
        if (valuationMethod === "fifo") {
          const consumption = await consumeBatchesOnSaleServer({
            userId: user.id,
            productId: prodObjId.toString(),
            saleQty: numQty,
            fallbackCostPrice: curCost,
          });
          if (consumption && consumption.effective_unit_cost > 0) {
            reductionCost = consumption.effective_unit_cost;
            consumedBatchSplits = consumption.consumed_batches || [];
          }
        } else {
          reductionCost = curCost;
        }
      }
    }

    await productsCollection.updateOne(
      { _id: prodObjId, user_id: userId },
      { $set: updateFields }
    );

    const finalAdjCost = actionType === "reduce" ? reductionCost : resolvedCost;
    await stockAdjustmentsCollection.updateOne(
      { _id: oldAdj._id },
      {
        $set: {
          stock_type: stockType,
          action_type: actionType,
          quantity: numQty,
          cost_price: finalAdjCost,
          batch_splits: consumedBatchSplits,
          reason: reason || "physicalCount",
          notes: notes?.trim() || "",
          date: parsedDate,
          updated_at: new Date(),
        },
      }
    );

    return NextResponse.json({
      success: true,
      newQuantity: finalQty,
      newDamagedQuantity: finalDamaged,
      newCostPrice: finalCost,
    });
  } catch (err: any) {
    console.error("Error updating stock adjustment:", err);
    return NextResponse.json(
      { error: err.message || "Failed to update stock adjustment" },
      { status: 500 }
    );
  }
}
