// src/app/[locale]/api/reports/stock/route.ts

import { getCollection, COLLECTIONS, toObjectId, updateUserLastActivity } from '@/lib/db/mongodb'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/utils'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser() as { id: string } | null
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    // 1. Calculate overall summary statistics using aggregation
    const statsPipeline = [
      { $match: query },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalStock: { $sum: { $ifNull: ["$quantity", 0] } },
          totalCostValue: {
            $sum: {
              $multiply: [
                { $ifNull: ["$quantity", 0] },
                { $toDouble: { $ifNull: ["$cost_price", 0] } }
              ]
            }
          },
          totalSellValue: {
            $sum: {
              $multiply: [
                { $ifNull: ["$quantity", 0] },
                { $toDouble: { $ifNull: ["$sell_price", 0] } }
              ]
            }
          },
          totalDamagedQuantity: { $sum: { $ifNull: ["$damaged_quantity", 0] } },
          totalDamagedValue: {
            $sum: {
              $multiply: [
                { $ifNull: ["$damaged_quantity", 0] },
                { $toDouble: { $ifNull: ["$cost_price", 0] } }
              ]
            }
          }
        }
      }
    ];

    const [statsResult, totalCount] = await Promise.all([
      productsCollection.aggregate(statsPipeline).toArray(),
      productsCollection.countDocuments(query)
    ]);

    const summary = statsResult[0] || {
      totalProducts: 0,
      totalStock: 0,
      totalCostValue: 0,
      totalSellValue: 0,
      totalDamagedQuantity: 0,
      totalDamagedValue: 0
    };

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

    // Convert _id to id for consistency
    const products = data.map(product => ({
      ...product,
      id: product._id.toString(),
      _id: undefined,
    }));

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
        totalProducts: summary.totalProducts,
        totalStock: summary.totalStock,
        totalCostValue: summary.totalCostValue,
        totalSellValue: summary.totalSellValue,
        totalProfitPotential: (summary.totalSellValue || 0) - (summary.totalCostValue || 0),
        totalDamagedQuantity: summary.totalDamagedQuantity,
        totalDamagedValue: summary.totalDamagedValue
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
