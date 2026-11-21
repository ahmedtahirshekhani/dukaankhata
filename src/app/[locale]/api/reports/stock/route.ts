// src/app/[locale]/api/reports/stock/route.ts

import { getCollection, COLLECTIONS, toObjectId, updateUserLastActivity } from '@/lib/db/mongodb'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/utils'
import { requirePermission } from "@/lib/auth/rbac";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser() as { id: string } | null
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const authCheck = await requirePermission("reports.view_stock");
    if (!authCheck.allowed) return authCheck.response!;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limitParam = searchParams.get("limit");
    const limit = limitParam === "-1" ? 0 : parseInt(limitParam || "10");
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "all";
    const branch = searchParams.get("branch") || "all";
    
    const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
    
    const query: any = { user_id: toObjectId(user.id) };

    if (category && category !== 'all') {
      query.category = category;
    }

    if (branch && branch !== 'all') {
      query.branch = branch;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Determine active stock valuation method (average or fifo)
    const { getValuationMethod } = await import('@/lib/inventory/valuation-engine');
    const valuationMethod = await getValuationMethod(user.id);
    const batchesCollection = await getCollection(COLLECTIONS.INVENTORY_BATCHES);

    let batchMap = new Map<string, any>();
    if (valuationMethod === "fifo") {
      const activeBatchesAgg = await batchesCollection.aggregate([
        {
          $match: {
            user_id: toObjectId(user.id),
            status: "active",
            remaining_quantity: { $gt: 0 }
          }
        },
        {
          $group: {
            _id: "$product_id",
            batchTotalQty: { $sum: "$remaining_quantity" },
            batchTotalCost: {
              $sum: { $multiply: ["$remaining_quantity", "$cost_price"] }
            },
            batchCount: { $sum: 1 },
            batches: {
              $push: {
                batch_number: "$batch_number",
                remaining_quantity: "$remaining_quantity",
                cost_price: "$cost_price",
                batch_date: "$batch_date"
              }
            }
          }
        }
      ]).toArray();
      batchMap = new Map(activeBatchesAgg.map(b => [b._id.toString(), b]));
    }

    // 1. Calculate overall summary statistics
    const allMatchingProducts = await productsCollection.find(query, {
      projection: {
        _id: 1,
        quantity: 1,
        cost_price: 1,
        purchase_price: 1,
        sell_price: 1,
        damaged_quantity: 1,
      }
    }).toArray();

    const totalCount = allMatchingProducts.length;
    let totalStock = 0;
    let totalCostValue = 0;
    let totalSellValue = 0;
    let totalDamagedQuantity = 0;
    let totalDamagedValue = 0;

    for (const prod of allMatchingProducts) {
      const pId = prod._id.toString();
      const pQty = Number(prod.quantity) || 0;
      const pMasterCost = Number(prod.cost_price ?? prod.purchase_price) || 0;
      const pSellPrice = Number(prod.sell_price) || 0;
      const pDamagedQty = Number(prod.damaged_quantity) || 0;

      totalStock += pQty;
      totalSellValue += pQty * pSellPrice;
      totalDamagedQuantity += pDamagedQty;
      totalDamagedValue += pDamagedQty * pMasterCost;

      if (valuationMethod === "fifo") {
        const batchInfo = batchMap.get(pId);
        if (batchInfo && batchInfo.batchTotalQty > 0) {
          if (pQty <= batchInfo.batchTotalQty) {
            const unitAvg = batchInfo.batchTotalCost / batchInfo.batchTotalQty;
            totalCostValue += pQty * unitAvg;
          } else {
            const extraQty = pQty - batchInfo.batchTotalQty;
            totalCostValue += batchInfo.batchTotalCost + (extraQty * pMasterCost);
          }
        } else {
          totalCostValue += pQty * pMasterCost;
        }
      } else {
        totalCostValue += pQty * pMasterCost;
      }
    }

    const totalPages = limit > 0 ? Math.ceil(totalCount / limit) : 1;
    const skip = limit > 0 ? (page - 1) * limit : 0;

    // 2. Fetch the paginated products
    const productsCursor = productsCollection
      .find(query)
      .sort({ created_at: -1 });

    if (limit > 0) {
      productsCursor.skip(skip).limit(limit);
    }

    const data = await productsCursor.toArray();

    // Map products with dynamic FIFO batch costs or weighted average costs
    const products = data.map(product => {
      const pId = product._id.toString();
      const pQty = Number(product.quantity) || 0;
      const pMasterCost = Number(product.cost_price ?? product.purchase_price) || 0;
      let effectiveCost = pMasterCost;
      let totalCostVal = pQty * pMasterCost;
      let batchCount = 0;
      let batches: any[] = [];

      if (valuationMethod === "fifo") {
        const batchInfo = batchMap.get(pId);
        if (batchInfo && batchInfo.batchTotalQty > 0) {
          batchCount = batchInfo.batchCount;
          batches = batchInfo.batches || [];
          if (pQty <= batchInfo.batchTotalQty) {
            const unitAvg = batchInfo.batchTotalCost / batchInfo.batchTotalQty;
            totalCostVal = Math.round(pQty * unitAvg * 100) / 100;
            effectiveCost = pQty > 0 ? Math.round((totalCostVal / pQty) * 100) / 100 : pMasterCost;
          } else {
            const extraQty = pQty - batchInfo.batchTotalQty;
            totalCostVal = Math.round((batchInfo.batchTotalCost + (extraQty * pMasterCost)) * 100) / 100;
            effectiveCost = pQty > 0 ? Math.round((totalCostVal / pQty) * 100) / 100 : pMasterCost;
          }
        }
      }

      return {
        ...product,
        id: pId,
        _id: undefined,
        effective_cost_price: effectiveCost,
        total_cost_value: totalCostVal,
        batch_count: batchCount,
        batches: batches,
        valuation_method: valuationMethod,
      };
    });

    // Fetch dynamic distinct categories and branches for this user's products
    const [uniqueCategories, uniqueBranches] = await Promise.all([
      productsCollection.distinct("category", { user_id: toObjectId(user.id) }),
      productsCollection.distinct("branch", { user_id: toObjectId(user.id) })
    ]);

    const filteredCategories = uniqueCategories.filter(Boolean) as string[];
    const filteredBranches = uniqueBranches.filter(Boolean) as string[];

    // Ensure defaults exist if empty
    if (!filteredCategories.includes("General")) filteredCategories.unshift("General");
    if (!filteredBranches.includes("Main")) filteredBranches.unshift("Main");

    await updateUserLastActivity();

    return NextResponse.json({
      products,
      categories: filteredCategories,
      branches: filteredBranches,
      summary: {
        totalProducts: totalCount,
        totalStock: Math.round(totalStock * 1000) / 1000,
        totalCostValue: Math.round(totalCostValue * 100) / 100,
        totalSellValue: Math.round(totalSellValue * 100) / 100,
        totalProfitPotential: Math.round((totalSellValue - totalCostValue) * 100) / 100,
        totalDamagedQuantity,
        totalDamagedValue: Math.round(totalDamagedValue * 100) / 100,
        valuationMethod,
      },
      pagination: {
        totalCount,
        totalPages,
        currentPage: page,
        pageSize: limit > 0 ? limit : totalCount
      }
    });

  } catch (err: any) {
    console.error("Error in stock report API:", err);
    return NextResponse.json({ error: "Server error", message: err.message }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
