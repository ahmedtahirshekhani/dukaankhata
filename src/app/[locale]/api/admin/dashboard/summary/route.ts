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

// Safely parse numeric value from various types
function parseAmount(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return isNaN(value) ? 0 : Math.max(0, value);
  if (typeof value === "string") {
    const parsed = parseFloat(value.replace(/[^0-9.-]/g, ""));
    return isNaN(parsed) ? 0 : Math.max(0, parsed);
  }
  return 0;
}

// Format date to YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

// Get date range for analytics
function getDateRange(days: number): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

export async function GET(): Promise<NextResponse> {
  try {
    let user;
    try {
      user = (await getCurrentUser()) as { id: string };
    } catch (error) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user?.id || typeof user.id !== "string" || user.id.length !== 24) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const userId = toObjectId(user.id);

    // Fetch required collections in parallel
    const [
      transactionsCollection,
      productsCollection,
      ordersCollection,
      orderItemsCollection,
      customerTransactionsCollection,
    ] = await Promise.all([
      getCollection(COLLECTIONS.TRANSACTIONS),
      getCollection(COLLECTIONS.PRODUCTS),
      getCollection(COLLECTIONS.ORDERS),
      getCollection(COLLECTIONS.ORDER_ITEMS),
      getCollection(COLLECTIONS.CUSTOMER_TRANSACTIONS),
    ]);

    const [transactions, products, orders, orderItems, customerTransactions] = await Promise.all([
      transactionsCollection.find({ user_id: userId }).toArray(),
      productsCollection.find({ user_id: userId }).toArray(),
      ordersCollection.find({ user_id: userId }).toArray(),
      orderItemsCollection.find({ user_id: userId }).toArray(),
      customerTransactionsCollection.find({ user_id: userId }).toArray(),
    ]);

    // Date ranges for current and previous periods
    const currentPeriod = getDateRange(30);
    const previousPeriod = {
      start: new Date(currentPeriod.start.getTime() - 30 * 24 * 60 * 60 * 1000),
      end: new Date(currentPeriod.start.getTime() - 1),
    };

    // Revenue tracking
    let counterSalesRevenue = 0;
    let counterSalesCurrentPeriod = 0;
    let counterSalesPreviousPeriod = 0;
    let orderPaymentsRevenue = 0;
    let orderPaymentsCurrentPeriod = 0;
    let orderPaymentsPreviousPeriod = 0;
    let customerPaymentsRevenue = 0;
    let customerPaymentsCurrentPeriod = 0;
    let customerPaymentsPreviousPeriod = 0;

    // Expense tracking
    let totalExpenses = 0;

    // Tracking maps
    const revenueTrendMap = new Map<string, number>();
    const cashflowMap = new Map<string, { income: number; expense: number }>();

    // Product lookup map
    const productMap = new Map<string, string>();
    products.forEach((product: any) => {
      const productId = product._id?.toString();
      if (productId) productMap.set(productId, product.name || product.title || "Unknown Product");
    });

    // Process transactions (income + expense)
    transactions.forEach((transaction: any) => {
      const amount = parseAmount(transaction.amount);
      if (amount <= 0) return;

      const createdAt = transaction.created_at || transaction.createdAt || transaction.date;
      const transactionDate = createdAt ? new Date(createdAt) : null;
      const type = String(transaction.type || "").toLowerCase().trim();

      if (type === "income") {
        counterSalesRevenue += amount;
        if (transactionDate && transactionDate >= currentPeriod.start && transactionDate <= currentPeriod.end) {
          counterSalesCurrentPeriod += amount;
          const dateKey = formatDate(transactionDate);
          revenueTrendMap.set(dateKey, (revenueTrendMap.get(dateKey) || 0) + amount);
          const cf = cashflowMap.get(dateKey) || { income: 0, expense: 0 };
          cf.income += amount;
          cashflowMap.set(dateKey, cf);
        }
        if (transactionDate && transactionDate >= previousPeriod.start && transactionDate <= previousPeriod.end) {
          counterSalesPreviousPeriod += amount;
        }
      } else if (type === "expense") {
        totalExpenses += amount;
        if (transactionDate && transactionDate >= currentPeriod.start && transactionDate <= currentPeriod.end) {
          const dateKey = formatDate(transactionDate);
          const cf = cashflowMap.get(dateKey) || { income: 0, expense: 0 };
          cf.expense += amount;
          cashflowMap.set(dateKey, cf);
        }
      }
    });

    // Process orders (paid amounts)
    orders.forEach((order: any) => {
      let paidAmount = 0;
      if (order.payments) {
        if (Array.isArray(order.payments)) {
          order.payments.forEach((p: any) => {
            paidAmount += parseAmount(p.paid_amount || p.amount || 0);
          });
        } else if (typeof order.payments === "object") {
          paidAmount = parseAmount(order.payments.paid_amount || order.payments.amount || 0);
        }
      }
      if (paidAmount === 0) {
        paidAmount = parseAmount(order.paid_amount || order.amount_paid || 0);
      }

      if (paidAmount > 0) {
        orderPaymentsRevenue += paidAmount;
        const createdAt = order.created_at || order.createdAt || order.date || order.order_date;
        const orderDate = createdAt ? new Date(createdAt) : null;

        if (orderDate && orderDate >= currentPeriod.start && orderDate <= currentPeriod.end) {
          orderPaymentsCurrentPeriod += paidAmount;
          const dateKey = formatDate(orderDate);
          revenueTrendMap.set(dateKey, (revenueTrendMap.get(dateKey) || 0) + paidAmount);
          const cf = cashflowMap.get(dateKey) || { income: 0, expense: 0 };
          cf.income += paidAmount;
          cashflowMap.set(dateKey, cf);
        }
        if (orderDate && orderDate >= previousPeriod.start && orderDate <= previousPeriod.end) {
          orderPaymentsPreviousPeriod += paidAmount;
        }
      }
    });

    // Process customer transactions
    customerTransactions.forEach((ct: any) => {
      const paymentAmount = parseAmount(ct.payment_amount || ct.paymentAmount || ct.amount || 0);
      if (paymentAmount <= 0) return;

      customerPaymentsRevenue += paymentAmount;
      const createdAt = ct.created_at || ct.createdAt || ct.date || ct.payment_date;
      const paymentDate = createdAt ? new Date(createdAt) : null;

      if (paymentDate && paymentDate >= currentPeriod.start && paymentDate <= currentPeriod.end) {
        customerPaymentsCurrentPeriod += paymentAmount;
        const dateKey = formatDate(paymentDate);
        revenueTrendMap.set(dateKey, (revenueTrendMap.get(dateKey) || 0) + paymentAmount);
        const cf = cashflowMap.get(dateKey) || { income: 0, expense: 0 };
        cf.income += paymentAmount;
        cashflowMap.set(dateKey, cf);
      }
      if (paymentDate && paymentDate >= previousPeriod.start && paymentDate <= previousPeriod.end) {
        customerPaymentsPreviousPeriod += paymentAmount;
      }
    });

    // Calculate totals
    const totalRevenue = counterSalesRevenue + orderPaymentsRevenue + customerPaymentsRevenue;
    const currentPeriodRevenue = counterSalesCurrentPeriod + orderPaymentsCurrentPeriod + customerPaymentsCurrentPeriod;
    const previousPeriodRevenue = counterSalesPreviousPeriod + orderPaymentsPreviousPeriod + customerPaymentsPreviousPeriod;
    const totalProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const growthRate = previousPeriodRevenue > 0
      ? ((currentPeriodRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100
      : currentPeriodRevenue > 0 ? 100 : 0;
    const daysWithData = revenueTrendMap.size || 1;
    const avgDailyRevenue = currentPeriodRevenue / Math.max(daysWithData, 1);

    // Top products calculation
    const productSales = new Map<string, { name: string; quantity: number; revenue: number }>();
    products.forEach((product: any) => {
      const productId = product._id?.toString();
      if (productId) {
        productSales.set(productId, { name: product.name || product.title || "Unknown", quantity: 0, revenue: 0 });
      }
    });

    orderItems.forEach((item: any) => {
      const productId = String(item.product_id || item.productId || item.product || "");
      const quantity = parseAmount(item.quantity || item.qty || 1);
      const price = parseAmount(item.price || item.unit_price || 0);
      const itemTotal = parseAmount(item.total || item.subtotal) || (quantity * price);
      if (quantity <= 0) return;

      const productName = productMap.get(productId) || item.product_name || item.name || "Unknown";
      const existing = productSales.get(productId) || { name: productName, quantity: 0, revenue: 0 };
      existing.quantity += quantity;
      existing.revenue += itemTotal;
      productSales.set(productId, existing);
    });

    transactions.forEach((transaction: any) => {
      const type = String(transaction.type || "").toLowerCase().trim();
      if (type !== "income") return;
      const productId = String(transaction.product_id || transaction.productId || transaction.product || "");
      if (!productId || productId === "undefined" || productId === "null" || productId === "") return;

      const quantity = parseAmount(transaction.quantity || transaction.qty || 1);
      const amount = parseAmount(transaction.amount || 0);
      const productName = productMap.get(productId) || transaction.product_name || "Counter Sale";
      const existing = productSales.get(productId) || { name: productName, quantity: 0, revenue: 0 };
      existing.quantity += quantity;
      existing.revenue += amount;
      productSales.set(productId, existing);
    });

    const totalProductQuantity = Array.from(productSales.values()).reduce((sum, p) => sum + p.quantity, 0);
    const topProducts = Array.from(productSales.values())
      .filter((p) => p.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5)
      .map((p) => ({
        name: p.name,
        quantity: p.quantity,
        revenue: p.revenue,
        percentage: totalProductQuantity > 0 ? (p.quantity / totalProductQuantity) * 100 : 0,
      }));

    // Generate 30-day trend
    const revenueTrend: Array<{ date: string; revenue: number; cumulative: number }> = [];
    let cumulative = 0;
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = formatDate(date);
      const dailyRevenue = revenueTrendMap.get(dateKey) || 0;
      cumulative += dailyRevenue;
      revenueTrend.push({ date: dateKey, revenue: dailyRevenue, cumulative });
    }

    // Generate 30-day cashflow
    const cashflow: Array<{ date: string; income: number; expense: number; net: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = formatDate(date);
      const data = cashflowMap.get(dateKey) || { income: 0, expense: 0 };
      cashflow.push({ date: dateKey, income: data.income, expense: data.expense, net: data.income - data.expense });
    }

    const dashboardData: DashboardData = {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      profitMargin: Math.round(profitMargin * 100) / 100,
      avgDailyRevenue: Math.round(avgDailyRevenue * 100) / 100,
      totalOrders: orders.length,
      revenueTrend,
      topProducts,
      cashflow,
      growthRate: Math.round(growthRate * 100) / 100,
    };

    return NextResponse.json(dashboardData, { status: 200 });
  } catch (error: any) {
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
