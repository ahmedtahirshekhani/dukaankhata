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

    // Filter by Category if specified
    if (category && category !== "all") {
      pipeline.push({
        $match: {
          category: { $regex: `^${category}$`, $options: "i" }
        }
      });
    }

    // Filter by Search term if specified
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { productName: { $regex: search, $options: "i" } },
            { sku: { $regex: search, $options: "i" } },
            { category: { $regex: search, $options: "i" } }
          ]
        }
      });
    }

    // Sorting stage
    const sortStage: any = {};
    if (sortBy === "productName") {
      sortStage.productName = sortOrder;
    } else if (sortBy === "totalQuantitySold") {
      sortStage.totalQuantitySold = sortOrder;
    } else if (sortBy === "totalProfit") {
      sortStage.totalProfit = sortOrder;
    } else {
      sortStage.totalRevenue = sortOrder;
    }
    pipeline.push({ $sort: sortStage });

    // Execute aggregation for all matching items
    const allMatchingItems = await ordersCollection.aggregate(pipeline).toArray();

    // Calculate Summary Statistics
    let totalItemsSold = 0;
    let totalGrossRevenue = 0;
    let totalDiscountGiven = 0;
    let totalNetRevenue = 0;
    let totalProfitEarned = 0;
    let topSellingItem = null as any;
    let topRevenueItem = null as any;

    if (allMatchingItems.length > 0) {
      for (const item of allMatchingItems) {
        totalItemsSold += item.totalQuantitySold || 0;
        totalGrossRevenue += item.totalGrossAmount || 0;
        totalDiscountGiven += item.totalDiscount || 0;
        totalNetRevenue += item.totalRevenue || 0;
        totalProfitEarned += item.totalProfit || 0;
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

