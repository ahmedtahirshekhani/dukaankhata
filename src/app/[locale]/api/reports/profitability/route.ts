// src/app/[locale]/api/reports/profitability/route.ts

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

    const authCheck = await requirePermission("reports.view_profitability");
    if (!authCheck.allowed) return authCheck.response!;

    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const page = parseInt(searchParams.get("page") || "1");
    const limitParam = searchParams.get("limit");
    const limit = limitParam === "-1" ? 0 : parseInt(limitParam || "10");
    const category = searchParams.get("category") || "";
    
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
    const expensesCollection = await getCollection(COLLECTIONS.EXPENSES);


    const transactionsCollection = await getCollection(COLLECTIONS.TRANSACTIONS);

    // Build base query
    const baseQuery: any = {
      user_id: userId,
    };

    // Calculate Revenue and COGS from Orders
    const revenueQuery: any = {
      ...baseQuery,
      status: { $ne: "cancelled" },
      created_at: { $gte: from, $lte: to },
    };

    const revenuePipeline = [
      { $match: revenueQuery },
      { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "products",
          localField: "items.product_id",
          foreignField: "_id",
          as: "product_info"
        }
      },
      {
        $addFields: {
          product_cost: { $arrayElemAt: ["$product_info.cost_price", 0] }
        }
      },
      {
        $group: {
          _id: "$_id",
          total_amount: { $first: "$total_amount" },
          total_cost: {
            $sum: {
              $multiply: [
                { $convert: { input: { $ifNull: ["$items.quantity", 0] }, to: "double", onError: 0, onNull: 0 } },
                {
                  $convert: {
                    input: {
                      $ifNull: [
                        "$items.cost_price",
                        {
                          $ifNull: [
                            "$items.purchase_price",
                            {
                              $ifNull: [
                                "$items.costPrice",
                                {
                                  $ifNull: [
                                    "$items.purchasePrice",
                                    { $ifNull: ["$product_cost", 0] }
                                  ]
                                }
                              ]
                            }
                          ]
                        }
                      ]
                    },
                    to: "double",
                    onError: 0,
                    onNull: 0
                  }
                }
              ]
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $convert: { input: "$total_amount", to: "double", onError: 0, onNull: 0 } } },
          totalCOGS: { $sum: { $convert: { input: "$total_cost", to: "double", onError: 0, onNull: 0 } } },
          totalOrders: { $sum: 1 },
          avgOrderValue: { $avg: { $convert: { input: "$total_amount", to: "double", onError: 0, onNull: 0 } } },
        },
      },
    ];

    // Counter Sales Query for Income Transactions linked to products
    const counterSalesQuery: any = {
      ...baseQuery,
      type: "income",
      productId: { $exists: true, $nin: ["0", null] },
      created_at: { $gte: from, $lte: to },
    };

    const counterSalesPipeline = [
      { $match: counterSalesQuery },
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "product_info"
        }
      },
      {
        $addFields: {
          product_cost: { $arrayElemAt: ["$product_info.cost_price", 0] }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $convert: { input: "$amount", to: "double", onError: 0, onNull: 0 } } },
          totalCOGS: {
            $sum: {
              $multiply: [
                { $convert: { input: { $ifNull: ["$quantity", 0] }, to: "double", onError: 0, onNull: 0 } },
                { $convert: { input: { $ifNull: ["$product_cost", 0] }, to: "double", onError: 0, onNull: 0 } }
              ]
            }
          },
          totalOrders: { $sum: 1 },
          avgOrderValue: { $avg: { $convert: { input: "$amount", to: "double", onError: 0, onNull: 0 } } },
        }
      }
    ];

    // Calculate Expenses
    const expensesQuery: any = {
      ...baseQuery,
      created_at: { $gte: from, $lte: to },
    };

    const expensePipeline = [
      { $match: expensesQuery },
      {
        $group: {
          _id: null,
          totalExpenses: { $sum: "$amount" },
          totalExpenseItems: { $sum: 1 },
          avgExpenseValue: { $avg: "$amount" },
        },
      },
    ];

    // Expenses grouped by Category
    const expensesByCategoryPipeline = [
      { $match: expensesQuery },
      {
        $group: {
          _id: { $ifNull: ["$category", "Uncategorized"] },
          totalAmount: { $sum: "$amount" }
        }
      },
      { $sort: { totalAmount: -1 } }
    ];

    // Get detailed breakdown by category for orders
    const categoryBreakdownPipeline = [
      { $match: revenueQuery },
      {
        $group: {
          _id: "$category",
          categoryRevenue: { $sum: { $convert: { input: "$total_amount", to: "double", onError: 0, onNull: 0 } } },
          categoryOrders: { $sum: 1 },
        },
      },
      { $sort: { categoryRevenue: -1 } },
    ];

    // Counter Sales Category Pipeline
    const counterSalesCategoryPipeline = [
      { $match: counterSalesQuery },
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "product_info"
        }
      },
      {
        $addFields: {
          category: { $arrayElemAt: ["$product_info.category", 0] }
        }
      },
      {
        $group: {
          _id: { $ifNull: ["$category", "Uncategorized"] },
          categoryRevenue: { $sum: { $convert: { input: "$amount", to: "double", onError: 0, onNull: 0 } } },
          categoryOrders: { $sum: 1 },
        }
      }
    ];

    // Fetch in parallel
    const [
      revenueResult, 
      counterSalesResult,
      expensesResult, 
      expensesByCategoryResult,
      orderCategoryBreakdown,
      counterSalesCategoryBreakdown
    ] = await Promise.all([
      ordersCollection.aggregate(revenuePipeline).toArray(),
      transactionsCollection.aggregate(counterSalesPipeline).toArray(),
      expensesCollection.aggregate(expensePipeline).toArray(),
      expensesCollection.aggregate(expensesByCategoryPipeline).toArray(),
      ordersCollection.aggregate(categoryBreakdownPipeline).toArray(),
      transactionsCollection.aggregate(counterSalesCategoryPipeline).toArray(),
    ]);

    const revenueData = revenueResult[0] || {
      totalRevenue: 0,
      totalCOGS: 0,
      totalOrders: 0,
      avgOrderValue: 0
    };
    
    const csData = counterSalesResult[0] || {
      totalRevenue: 0,
      totalCOGS: 0,
      totalOrders: 0,
      avgOrderValue: 0
    };

    const expensesData = expensesResult[0] || {
      totalExpenses: 0,
      totalExpenseItems: 0,
      avgExpenseValue: 0,
    };

    // Calculate Profit & Margins
    const totalRevenue = (Number(revenueData.totalRevenue) || 0) + (Number(csData.totalRevenue) || 0);
    const totalCOGS = (Number(revenueData.totalCOGS) || 0) + (Number(csData.totalCOGS) || 0);
    const totalOrders = (Number(revenueData.totalOrders) || 0) + (Number(csData.totalOrders) || 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const grossProfit = totalRevenue - totalCOGS;
    
    const totalExpenses = Number(expensesData.totalExpenses) || 0;
    const operatingProfit = grossProfit - totalExpenses;
    
    const profitMargin =
      totalRevenue > 0 ? Math.round((operatingProfit / totalRevenue) * 100 * 100) / 100 : 0;

    // Expenses by Category formatting
    const expensesByCategory = expensesByCategoryResult.map((item: any) => ({
      category: item._id,
      amount: item.totalAmount || 0
    }));

    // Merge Category Breakdown
    const combinedCategories: Record<string, any> = {};
    
    orderCategoryBreakdown.forEach((item: any) => {
      const cat = item._id || "Uncategorized";
      combinedCategories[cat] = {
        category: cat,
        revenue: item.categoryRevenue || 0,
        orders: item.categoryOrders || 0,
      };
    });

    counterSalesCategoryBreakdown.forEach((item: any) => {
      const cat = item._id || "Uncategorized";
      if (!combinedCategories[cat]) {
        combinedCategories[cat] = { category: cat, revenue: 0, orders: 0 };
      }
      combinedCategories[cat].revenue += item.categoryRevenue || 0;
      combinedCategories[cat].orders += item.categoryOrders || 0;
    });

    const breakdown = Object.values(combinedCategories).sort((a: any, b: any) => b.revenue - a.revenue);

    // Get top expenses
    const topExpensesQuery = {
      ...baseQuery,
      created_at: { $gte: from, $lte: to },
    };

    const skip = limit > 0 ? (page - 1) * limit : 0;

    const topExpensesCursor = expensesCollection
      .find(topExpensesQuery)
      .sort({ amount: -1 });

    if (limit > 0) {
      topExpensesCursor.skip(skip).limit(limit);
    }

    const expenseItems = await topExpensesCursor.toArray();

    const totalExpenseCount = await expensesCollection.countDocuments(topExpensesQuery);
    const totalPages = limit > 0 ? Math.ceil(totalExpenseCount / limit) : 1;

    // Format expense items
    const expenses = expenseItems.map((expense: any) => ({
      id: expense._id.toString(),
      category: expense.category || "Uncategorized",
      description: expense.description || "-",
      amount: expense.amount || 0,
      date: expense.created_at || new Date(),
      paymentMethod: expense.payment_method || "-",
    }));

    const summary = {
      totalRevenue,
      ordersRevenue: Number(revenueData.totalRevenue) || 0,
      counterSalesRevenue: Number(csData.totalRevenue) || 0,
      totalCOGS,
      grossProfit,
      totalExpenses,
      operatingProfit,
      profitMargin,
      totalOrders: totalOrders || 0,
      totalExpenseItems: expensesData.totalExpenseItems || 0,
      avgOrderValue: Math.round(avgOrderValue || 0),
      avgExpenseValue: Math.round(expensesData.avgExpenseValue || 0),
    };

    await updateUserLastActivity();

    return NextResponse.json({
      summary,
      breakdown,
      expenses,
      expensesByCategory,
      pagination: {
        currentPage: page,
        pageSize: limit > 0 ? limit : totalExpenseCount,
        totalCount: totalExpenseCount,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Error fetching profitability report:", error);
    return NextResponse.json(
      { error: "Failed to fetch profitability report" },
      { status: 500 }
    );
  }
}
