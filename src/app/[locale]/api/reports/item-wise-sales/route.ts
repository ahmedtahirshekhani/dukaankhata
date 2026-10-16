// src/app/[locale]/api/reports/item-wise-sales/route.ts

import { getCollection, COLLECTIONS, toObjectId, updateUserLastActivity } from '@/lib/db/mongodb';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/utils';
import { requirePermission } from "@/lib/auth/rbac";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser() as { id: string } | null;
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // RBAC Permission Check
    const authCheck = await requirePermission("reports.view_item_wise_sales");
    if (!authCheck.allowed) return authCheck.response!;

    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const page = parseInt(searchParams.get("page") || "1");
    const limitParam = searchParams.get("limit");
    const limit = limitParam === "-1" ? 0 : parseInt(limitParam || "10");
    const search = searchParams.get("search")?.trim() || "";
    const category = searchParams.get("category") || "all";
    const sortBy = searchParams.get("sortBy") || "totalRevenue"; // totalRevenue, totalQuantitySold, totalProfit, productName
    const sortOrder = searchParams.get("sortOrder") === "asc" ? 1 : -1;

    // Validate dates
    if (!fromDate || !toDate) {
      return NextResponse.json(
        { error: "fromDate and toDate are required" },
        { status: 400 }
      );
    }

    const from = new Date(fromDate);
    const to = new Date(toDate);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json(
        { error: "Invalid date range" },
        { status: 400 }
      );
    }

    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);

    const userId = toObjectId(user.id);
    const ordersCollection = await getCollection(COLLECTIONS.ORDERS);

    // 1. Base query for orders
    const orderMatch: any = {
      user_id: userId,
      status: { $ne: "cancelled" },
      $or: [
        { sale_date: { $gte: from.toISOString(), $lte: to.toISOString() } },
        { created_at: { $gte: from, $lte: to } },
        { created_at: { $gte: from.toISOString(), $lte: to.toISOString() } }
      ]
    };

    // 2. Build aggregation pipeline
    const pipeline: any[] = [
      { $match: orderMatch },
      { $unwind: { path: "$items", preserveNullAndEmptyArrays: false } },
      
      // Normalize item numbers
      {
        $project: {
          productId: { $ifNull: ["$items.product_id", { $ifNull: ["$items.id", "$items._id"] }] },
          productName: { $ifNull: ["$items.name", { $ifNull: ["$items.product_name", "Unknown Item"] }] },
          sku: { $ifNull: ["$items.sku", ""] },
          category: { $ifNull: ["$items.category", ""] },
          uom: { $ifNull: ["$items.unit_of_measurement", { $ifNull: ["$items.uom", "pcs"] }] },
          qty: {
            $convert: {
              input: { $ifNull: ["$items.quantity", 0] },
              to: "double",
              onError: 0,
              onNull: 0
            }
          },
          price: {
            $convert: {
              input: { $ifNull: ["$items.price", { $ifNull: ["$items.sell_price", 0] }] },
              to: "double",
              onError: 0,
              onNull: 0
            }
          },
          costPrice: {
            $convert: {
              input: {
                $ifNull: [
                  "$items.cost_price",
                  { $ifNull: ["$items.purchase_price", { $ifNull: ["$items.costPrice", 0] }] }
                ]
              },
              to: "double",
              onError: 0,
              onNull: 0
            }
          },
          discount: {
            $convert: {
              input: { $ifNull: ["$items.discount", 0] },
              to: "double",
              onError: 0,
              onNull: 0
            }
          },
          discountType: { $ifNull: ["$items.discountType", "value"] }
        }
      },

      // Calculate line financial values
      {
        $addFields: {
          grossAmount: { $multiply: ["$qty", "$price"] },
          discountAmount: {
            $cond: [
              { $eq: ["$discountType", "percentage"] },
              { $divide: [{ $multiply: [{ $multiply: ["$qty", "$price"] }, "$discount"] }, 100] },
              "$discount"
            ]
          }
        }
      },
      {
        $addFields: {
          netRevenue: {
            $max: [0, { $subtract: ["$grossAmount", "$discountAmount"] }]
          },
          totalCost: { $multiply: ["$qty", "$costPrice"] }
        }
      },
      {
        $addFields: {
          profit: { $subtract: ["$netRevenue", "$totalCost"] }
        }
      },

      // Group by Product ID
      {
        $group: {
          _id: { $toString: "$productId" },
          productName: { $first: "$productName" },
          itemSku: { $first: "$sku" },
          itemCategory: { $first: "$category" },
          uom: { $first: "$uom" },
          totalQuantitySold: { $sum: "$qty" },
          totalGrossAmount: { $sum: "$grossAmount" },
          totalDiscount: { $sum: "$discountAmount" },
          totalRevenue: { $sum: "$netRevenue" },
          totalCost: { $sum: "$totalCost" },
          totalProfit: { $sum: "$profit" },
          invoicesCount: { $sum: 1 },
          minSellPrice: { $min: "$price" },
          maxSellPrice: { $max: "$price" }
        }
      },

      // Lookup live product details (Current stock, SKU, Category, Cost Price fallback)
      {
        $lookup: {
          from: "products",
          let: { prodId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: [{ $toString: "$_id" }, "$$prodId"] },
                    { $eq: ["$id", "$$prodId"] }
                  ]
                }
              }
            }
          ],
          as: "productDoc"
        }
      },
      {
        $addFields: {
          productInfo: { $arrayElemAt: ["$productDoc", 0] }
        }
      },
      {
        $project: {
          _id: 1,
          productId: "$_id",
          productName: { $ifNull: ["$productInfo.name", "$productName"] },
          sku: { $ifNull: ["$productInfo.sku", { $ifNull: ["$itemSku", "-"] }] },
          category: { $ifNull: ["$productInfo.category", { $ifNull: ["$itemCategory", "Uncategorized"] }] },
          uom: { $ifNull: ["$productInfo.unit_of_measurement", "$uom"] },
          currentStock: { $ifNull: ["$productInfo.quantity", 0] },
          totalQuantitySold: { $round: ["$totalQuantitySold", 2] },
          totalGrossAmount: { $round: ["$totalGrossAmount", 2] },
          totalDiscount: { $round: ["$totalDiscount", 2] },
          totalRevenue: { $round: ["$totalRevenue", 2] },
          totalCost: { $round: ["$totalCost", 2] },
          totalProfit: { $round: ["$totalProfit", 2] },
          invoicesCount: 1,
          minSellPrice: { $round: ["$minSellPrice", 2] },
          maxSellPrice: { $round: ["$maxSellPrice", 2] },
          avgSellingPrice: {
            $cond: [
              { $gt: ["$totalQuantitySold", 0] },
              { $round: [{ $divide: ["$totalRevenue", "$totalQuantitySold"] }, 2] },
              0
            ]
          },
          profitMargin: {
            $cond: [
              { $gt: ["$totalRevenue", 0] },
              { $round: [{ $multiply: [{ $divide: ["$totalProfit", "$totalRevenue"] }, 100] }, 1] },
              0
            ]
          }
        }
      }
    ];

    // Execute aggregation for all matching sales
    const allMatchingSales = await ordersCollection.aggregate(pipeline).toArray();

    // 3. Query Sale Returns in the same date range
    const saleReturnsCollection = await getCollection(COLLECTIONS.SALE_RETURN_TRANSACTIONS);
    const returnMatch: any = {
      user_id: userId,
      $or: [
        { date: { $gte: from, $lte: to } },
        { date: { $gte: from.toISOString(), $lte: to.toISOString() } },
        { created_at: { $gte: from, $lte: to } },
        { created_at: { $gte: from.toISOString(), $lte: to.toISOString() } }
      ]
    };

    const returnPipeline: any[] = [
      { $match: returnMatch },
      { $unwind: { path: "$items", preserveNullAndEmptyArrays: false } },
      {
        $project: {
          productId: { $ifNull: ["$items.productId", { $ifNull: ["$items.product_id", "$items.id"] }] },
          itemName: { $ifNull: ["$items.itemName", { $ifNull: ["$items.name", "Unknown Item"] }] },
          quantity: {
            $convert: {
              input: { $ifNull: ["$items.quantity", 0] },
              to: "double",
              onError: 0,
              onNull: 0
            }
          },
          rate: {
            $convert: {
              input: { $ifNull: ["$items.rate", 0] },
              to: "double",
              onError: 0,
              onNull: 0
            }
          },
          amount: {
            $convert: {
              input: { $ifNull: ["$items.amount", 0] },
              to: "double",
              onError: 0,
              onNull: 0
            }
          }
        }
      },
      {
        $group: {
          _id: { $toString: "$productId" },
          productName: { $first: "$itemName" },
          totalQuantityReturned: { $sum: "$quantity" },
          totalReturnAmount: { $sum: "$amount" },
          returnsCount: { $sum: 1 }
        }
      }
    ];

    const returnResults = await saleReturnsCollection.aggregate(returnPipeline).toArray();
    const returnsByProductId = new Map<string, {
      totalQuantityReturned: number;
      totalReturnAmount: number;
      returnsCount: number;
      productName: string;
    }>();

    for (const r of returnResults) {
      returnsByProductId.set(String(r._id), {
        totalQuantityReturned: r.totalQuantityReturned || 0,
        totalReturnAmount: r.totalReturnAmount || 0,
        returnsCount: r.returnsCount || 0,
        productName: r.productName || ""
      });
    }

    // 4. Merge Sales and Returns to compute Net Sales
    const processedMap = new Map<string, any>();

    for (const item of allMatchingSales) {
      const prodId = String(item.productId);
      const returnData = returnsByProductId.get(prodId);
      const totalReturnedQuantity = returnData?.totalQuantityReturned || 0;
      const totalReturnedAmount = returnData?.totalReturnAmount || 0;

      const grossQuantity = item.totalQuantitySold || 0;
      const grossRevenue = item.totalRevenue || 0;
      const grossCost = item.totalCost || 0;

      // Net Quantity Sold
      const netQuantitySold = Math.max(0, grossQuantity - totalReturnedQuantity);

      // Net Revenue after subtracting Return Amount
      const netRevenue = Math.max(0, grossRevenue - totalReturnedAmount);

      // Unit Cost from original sales
      const unitCost = grossQuantity > 0 ? (grossCost / grossQuantity) : 0;
      const netCost = Math.max(0, netQuantitySold * unitCost);

      // Net Profit
      const netProfit = netRevenue - netCost;

      const avgSellingPrice = netQuantitySold > 0 
        ? Math.round((netRevenue / netQuantitySold) * 100) / 100 
        : (grossQuantity > 0 ? Math.round((grossRevenue / grossQuantity) * 100) / 100 : 0);

      const profitMargin = netRevenue > 0 
        ? Math.round(((netProfit / netRevenue) * 100) * 10) / 10 
        : 0;

      processedMap.set(prodId, {
        _id: prodId,
        productId: prodId,
        productName: item.productName,
        sku: item.sku,
        category: item.category,
        uom: item.uom,
        currentStock: item.currentStock,
        totalGrossQuantity: Math.round(grossQuantity * 100) / 100,
        totalReturnedQuantity: Math.round(totalReturnedQuantity * 100) / 100,
        totalReturnedAmount: Math.round(totalReturnedAmount * 100) / 100,
        totalQuantitySold: Math.round(netQuantitySold * 100) / 100,
        totalGrossAmount: Math.round(item.totalGrossAmount * 100) / 100,
        totalDiscount: Math.round(item.totalDiscount * 100) / 100,
        totalRevenue: Math.round(netRevenue * 100) / 100,
        totalCost: Math.round(netCost * 100) / 100,
        totalProfit: Math.round(netProfit * 100) / 100,
        invoicesCount: item.invoicesCount || 1,
        minSellPrice: item.minSellPrice,
        maxSellPrice: item.maxSellPrice,
        avgSellingPrice,
        profitMargin
      });
    }

    // Include products that only had returns in this period (0 sales)
    const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
    for (const [prodId, returnData] of Array.from(returnsByProductId.entries())) {
      if (!processedMap.has(prodId)) {
        let prodInfo: any = null;
        try {
          prodInfo = await productsCollection.findOne({
            $or: [
              { _id: toObjectId(prodId) },
              { id: prodId }
            ]
          });
        } catch {
          // ignore invalid objectId
        }

        const categoryName = prodInfo?.category || "Uncategorized";
        const sku = prodInfo?.sku || "-";
        const productName = prodInfo?.name || returnData.productName || "Unknown Item";
        const uom = prodInfo?.unit_of_measurement || "pcs";
        const currentStock = prodInfo?.quantity || 0;

        processedMap.set(prodId, {
          _id: prodId,
          productId: prodId,
          productName,
          sku,
          category: categoryName,
          uom,
          currentStock,
          totalGrossQuantity: 0,
          totalReturnedQuantity: Math.round(returnData.totalQuantityReturned * 100) / 100,
          totalReturnedAmount: Math.round(returnData.totalReturnAmount * 100) / 100,
          totalQuantitySold: 0,
          totalGrossAmount: 0,
          totalDiscount: 0,
          totalRevenue: 0,
          totalCost: 0,
          totalProfit: 0,
          invoicesCount: 0,
          minSellPrice: 0,
          maxSellPrice: 0,
          avgSellingPrice: 0,
          profitMargin: 0
        });
      }
    }

    let allMatchingItems = Array.from(processedMap.values());

    // Filter by Category if specified
    if (category && category !== "all") {
      const catRegex = new RegExp(`^${category}$`, "i");
      allMatchingItems = allMatchingItems.filter(item => catRegex.test(item.category));
    }

    // Filter by Search term if specified
    if (search) {
      const searchRegex = new RegExp(search, "i");
      allMatchingItems = allMatchingItems.filter(item => 
        searchRegex.test(item.productName) || 
        searchRegex.test(item.sku) || 
        searchRegex.test(item.category)
      );
    }

    // Sort items
    allMatchingItems.sort((a, b) => {
      let valA = a[sortBy] ?? 0;
      let valB = b[sortBy] ?? 0;
      if (typeof valA === "string") {
        return sortOrder === 1 ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortOrder === 1 ? valA - valB : valB - valA;
    });

    // Calculate Summary Statistics
    let totalItemsSold = 0;
    let totalGrossRevenue = 0;
    let totalDiscountGiven = 0;
    let totalNetRevenue = 0;
    let totalProfitEarned = 0;
    let totalReturnedUnits = 0;
    let totalReturnedAmount = 0;
    let topSellingItem = null as any;
    let topRevenueItem = null as any;

    if (allMatchingItems.length > 0) {
      for (const item of allMatchingItems) {
        totalItemsSold += item.totalQuantitySold || 0;
        totalGrossRevenue += item.totalGrossAmount || 0;
        totalDiscountGiven += item.totalDiscount || 0;
        totalNetRevenue += item.totalRevenue || 0;
        totalProfitEarned += item.totalProfit || 0;
        totalReturnedUnits += item.totalReturnedQuantity || 0;
        totalReturnedAmount += item.totalReturnedAmount || 0;
      }

      // Find top selling by quantity and revenue
      topSellingItem = [...allMatchingItems].sort((a, b) => b.totalQuantitySold - a.totalQuantitySold)[0] || null;
      topRevenueItem = [...allMatchingItems].sort((a, b) => b.totalRevenue - a.totalRevenue)[0] || null;
    }

    const totalCount = allMatchingItems.length;
    const totalPages = limit > 0 ? Math.ceil(totalCount / limit) : 1;
    const skip = limit > 0 ? (page - 1) * limit : 0;

    const paginatedItems = limit > 0 
      ? allMatchingItems.slice(skip, skip + limit) 
      : allMatchingItems;

    await updateUserLastActivity();

    return NextResponse.json({
      items: paginatedItems,
      summary: {
        totalProductsCount: totalCount,
        totalItemsSold: Math.round(totalItemsSold * 100) / 100,
        totalGrossRevenue: Math.round(totalGrossRevenue * 100) / 100,
        totalDiscountGiven: Math.round(totalDiscountGiven * 100) / 100,
        totalReturnedUnits: Math.round(totalReturnedUnits * 100) / 100,
        totalReturnedAmount: Math.round(totalReturnedAmount * 100) / 100,
        totalNetRevenue: Math.round(totalNetRevenue * 100) / 100,
        totalProfitEarned: Math.round(totalProfitEarned * 100) / 100,
        overallProfitMargin: totalNetRevenue > 0 
          ? Math.round((totalProfitEarned / totalNetRevenue) * 1000) / 10 
          : 0,
        topSellingItem: topSellingItem ? {
          name: topSellingItem.productName,
          quantity: topSellingItem.totalQuantitySold,
          revenue: topSellingItem.totalRevenue
        } : null,
        topRevenueItem: topRevenueItem ? {
          name: topRevenueItem.productName,
          quantity: topRevenueItem.totalQuantitySold,
          revenue: topRevenueItem.totalRevenue
        } : null
      },
      pagination: {
        page,
        limit,
        totalCount,
        totalPages
      }
    });

  } catch (error: any) {
    console.error("Failed to generate Item Wise Sale Report:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}

