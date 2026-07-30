import { NextResponse } from "next/server";
import { getCollection, COLLECTIONS, toObjectId } from "@/lib/db/mongodb";
import { getCurrentUser } from "@/lib/auth/utils";
import { hasModuleAccess, requireAnyPermission } from "@/lib/auth/rbac";

interface DashboardData {
  totalBalance: number;
  totalPayable: number;
  totalRevenue: number;
  totalPurchases: number;
  totalExpenses: number;
  totalProfit: number;
  profitMargin: number;
  avgDailyRevenue: number;
  totalOrders: number;
  revenueTrend: Array<{ date: string; revenue: number; cumulative: number }>;
  topProducts: Array<{ name: string; quantity: number; revenue: number; percentage: number }>;
  cashflow: Array<{ date: string; income: number; expense: number; net: number }>;
  growthRate: number;
}

function parseAmount(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return isNaN(value) ? 0 : Math.max(0, value);
  if (typeof value === "string") {
    const parsed = parseFloat(value.replace(/[^0-9.-]/g, ""));
    return isNaN(parsed) ? 0 : Math.max(0, parsed);
  }
  return 0;
}

function getCurrentMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}


export async function GET(): Promise<NextResponse> {
  try {
    let user;
    try {
      user = (await getCurrentUser()) as { id: string };
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user?.id || typeof user.id !== "string" || user.id.length !== 24) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const authCheck = await requireAnyPermission([
      "sales.view_invoice", 
      "purchase.view_purchase_bill", 
      "expenses.view", 
      "customers.view", 
      "reports.view"
    ]);
    if (!authCheck.allowed) return authCheck.response!;

    const userId = toObjectId(user.id);
    const [ordersCollection, saleReturnCollection, purchaseBillsCollection, expensesCollection, partiesCollection] = await Promise.all([
      getCollection(COLLECTIONS.ORDERS),
      getCollection(COLLECTIONS.SALE_RETURN_TRANSACTIONS),
      getCollection(COLLECTIONS.PURCHASE_BILLS),
      getCollection(COLLECTIONS.EXPENSES),
      getCollection(COLLECTIONS.PARTIES),
    ]);

    const { start, end } = getCurrentMonthRange();

    const dateFilter = { $or: [
      { sale_date: { $gte: start, $lte: end } },
      { created_at: { $gte: start, $lte: end } },
      { order_date: { $gte: start, $lte: end } },
      { date: { $gte: start, $lte: end } },
    ] };

    const [
      currentMonthOrders,
      currentMonthReturns,
      purchasesResult,
      debitNotesResult,
      currentMonthExpenses,
      partyReceivableResult,
      partyPayableResult,
    ] = await Promise.all([
      ordersCollection.find({ user_id: userId, ...dateFilter }).toArray(),
      // Sale returns netted from revenue
      saleReturnCollection.aggregate([
        { $match: { user_id: userId, ...dateFilter } },
        { $group: { _id: null, total: { $sum: "$total_amount" } } },
      ]).toArray(),
      // Purchases (bill_type = "purchase")
      purchaseBillsCollection.aggregate([
        { $match: { user_id: userId, bill_type: "purchase", ...dateFilter } },
        { $group: { _id: null, total: { $sum: "$total_amount" } } },
      ]).toArray(),
      // Debit notes (purchase returns) netted from purchases
      purchaseBillsCollection.aggregate([
        { $match: { user_id: userId, bill_type: "debit-note", ...dateFilter } },
        { $group: { _id: null, total: { $sum: "$total_amount" } } },
      ]).toArray(),
      expensesCollection
        .find({ user_id: userId, $or: [{ date: { $gte: start, $lte: end } }, { created_at: { $gte: start, $lte: end } }] })
        .toArray(),
      // Receivable: sum of positive party balances
      partiesCollection.aggregate([
        { $match: { user_id: userId, is_delete: { $ne: 1 }, balance: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: "$balance" } } },
      ]).toArray(),
      // Payable: sum of absolute negative party balances
      partiesCollection.aggregate([
        { $match: { user_id: userId, is_delete: { $ne: 1 }, balance: { $lt: 0 } } },
        { $group: { _id: null, total: { $sum: "$balance" } } },
      ]).toArray(),
    ]);

    const grossSales = currentMonthOrders.reduce((sum, order: any) => {
      return sum + parseAmount(order?.total_amount ?? order?.total ?? 0);
    }, 0);
    const saleReturnsTotal = currentMonthReturns[0]?.total ?? 0;
    const currentMonthSales = Math.max(0, grossSales - saleReturnsTotal);

    const totalBalance = partyReceivableResult[0]?.total ?? 0;
    const totalPayable = Math.abs(partyPayableResult[0]?.total ?? 0);
    const totalPurchases = Math.max(0, (purchasesResult[0]?.total ?? 0) - (debitNotesResult[0]?.total ?? 0));

    const currentMonthExpensesTotal = currentMonthExpenses.reduce(
      (sum, expense: any) => sum + parseAmount(expense?.amount ?? 0),
      0,
    );

    const canViewSales = await hasModuleAccess("sales");
    const canViewPurchases = await hasModuleAccess("purchase");
    const canViewExpenses = await hasModuleAccess("expenses");
    const canViewCustomers = await hasModuleAccess("customers");

    const dashboardData: DashboardData = {
      totalBalance: canViewCustomers ? Math.round(totalBalance * 100) / 100 : 0,
      totalPayable: canViewCustomers ? Math.round(totalPayable * 100) / 100 : 0,
      totalRevenue: canViewSales ? Math.round(currentMonthSales * 100) / 100 : 0,
      totalPurchases: canViewPurchases ? Math.round(totalPurchases * 100) / 100 : 0,
      totalExpenses: canViewExpenses ? Math.round(currentMonthExpensesTotal * 100) / 100 : 0,
      totalProfit: 0,
      profitMargin: 0,
      avgDailyRevenue: 0,
      totalOrders: currentMonthOrders.length,
      revenueTrend: [],
      topProducts: [],
      cashflow: [],
      growthRate: 0,
    };

    return NextResponse.json(dashboardData, { status: 200 });
  } catch (error) {
    console.error("Dashboard summary error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        totalBalance: 0,
        totalPayable: 0,
        totalRevenue: 0,
        totalPurchases: 0,
        totalExpenses: 0,
        totalProfit: 0,
        profitMargin: 0,
        avgDailyRevenue: 0,
        totalOrders: 0,
        revenueTrend: [],
        topProducts: [],
        cashflow: [],
        growthRate: 0,
      },
      { status: 500 }
    );
  }
}
