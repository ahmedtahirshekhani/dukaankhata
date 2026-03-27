import { NextResponse } from "next/server";
import { getCollection, COLLECTIONS, toObjectId } from "@/lib/db/mongodb";
import { getCurrentUser } from "@/lib/auth/utils";

interface DashboardData {
  totalRevenue: number;
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

    const userId = toObjectId(user.id);
    const ordersCollection = await getCollection(COLLECTIONS.ORDERS);

    const { start, end } = getCurrentMonthRange();
    const orders = await ordersCollection
      .find({
        user_id: userId,
        $or: [
          { sale_date: { $gte: start, $lte: end } },
          { created_at: { $gte: start, $lte: end } },
          { order_date: { $gte: start, $lte: end } },
        ],
      })
      .toArray();

    const currentMonthSales = orders.reduce((sum, order: any) => {
      const total = parseAmount(order?.total_amount ?? order?.total ?? 0);
      return sum + total;
    }, 0);

    const dashboardData: DashboardData = {
      totalRevenue: Math.round(currentMonthSales * 100) / 100,
      totalExpenses: 0,
      totalProfit: 0,
      profitMargin: 0,
      avgDailyRevenue: 0,
      totalOrders: orders.length,
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
        totalRevenue: 0,
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
