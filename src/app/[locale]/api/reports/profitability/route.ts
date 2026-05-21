// src/app/[locale]/api/reports/profitability/route.ts

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

    // Build base query
    const baseQuery: any = {
      user_id: userId,
    };

    // Calculate Revenue from Orders
    const revenueQuery: any = {
      ...baseQuery,
      status: { $ne: "cancelled" },
      created_at: { $gte: from, $lte: to },
    };

    const revenuePipeline = [
      { $match: revenueQuery },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$total_amount" },
          totalOrders: { $sum: 1 },
          avgOrderValue: { $avg: "$total_amount" },
        },
      },
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

    // Fetch both in parallel
    const [revenueResult, expensesResult] = await Promise.all([
      ordersCollection.aggregate(revenuePipeline).toArray(),
      expensesCollection.aggregate(expensePipeline).toArray(),
    ]);

    const revenueData = revenueResult[0] || {
      totalRevenue: 0,
      totalOrders: 0,
      avgOrderValue: 0,
    };

    const expensesData = expensesResult[0] || {
      totalExpenses: 0,
      totalExpenseItems: 0,
      avgExpenseValue: 0,
    };

    // Calculate Profit & Margins
    const totalRevenue = Number(revenueData.totalRevenue) || 0;
    const totalExpenses = Number(expensesData.totalExpenses) || 0;
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin =
      totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100 * 100) / 100 : 0;

    // Get detailed breakdown by category
    const categoryBreakdownPipeline = [
      { $match: revenueQuery },
      {
        $group: {
          _id: "$category",
          categoryRevenue: { $sum: "$total_amount" },
          categoryOrders: { $sum: 1 },
        },
      },
      { $sort: { categoryRevenue: -1 } },
    ];

    const categoryBreakdown = await ordersCollection
      .aggregate(categoryBreakdownPipeline)
      .toArray();

    // Format category breakdown
    const breakdown = categoryBreakdown.map((item: any) => ({
      category: item._id || "Uncategorized",
      revenue: item.categoryRevenue || 0,
      orders: item.categoryOrders || 0,
    }));

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
      totalExpenses,
      netProfit,
      profitMargin,
      totalOrders: revenueData.totalOrders || 0,
      totalExpenseItems: expensesData.totalExpenseItems || 0,
      avgOrderValue: Math.round(revenueData.avgOrderValue || 0),
      avgExpenseValue: Math.round(expensesData.avgExpenseValue || 0),
    };

    await updateUserLastActivity();

    return NextResponse.json({
      summary,
      breakdown,
      expenses,
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
