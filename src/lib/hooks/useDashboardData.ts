"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/offline-db";

export type CounterRange =
  | "today"
  | "thisWeek"
  | "lastWeek"
  | "thisMonth"
  | "lastMonth"
  | "ytd";

const getStartOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);

const getEndOfDay = (date: Date) =>
  new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999
  );

export const getRangeDates = (rangeKey: CounterRange) => {
  const now = new Date();
  let start = getStartOfDay(now);
  let end = getEndOfDay(now);

  switch (rangeKey) {
    case "today":
      start = getStartOfDay(now);
      end = getEndOfDay(now);
      break;
    case "thisWeek": {
      const day = now.getDay();
      const diffToMonday = (day + 6) % 7;
      start = getStartOfDay(now);
      start.setDate(start.getDate() - diffToMonday);
      end = getEndOfDay(now);
      break;
    }
    case "lastWeek": {
      const day = now.getDay();
      const diffToMonday = (day + 6) % 7;
      const thisWeekStart = getStartOfDay(now);
      thisWeekStart.setDate(thisWeekStart.getDate() - diffToMonday);
      start = new Date(thisWeekStart);
      start.setDate(start.getDate() - 7);
      end = getEndOfDay(
        new Date(
          thisWeekStart.getFullYear(),
          thisWeekStart.getMonth(),
          thisWeekStart.getDate() - 1
        )
      );
      break;
    }
    case "thisMonth":
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = getEndOfDay(now);
      break;
    case "lastMonth":
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
    case "ytd":
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      end = getEndOfDay(now);
      break;
  }

  return { start, end };
};

export interface DashboardStats {
  totalBalance: number;
  totalPayable: number;
  totalRevenue: number;
  totalPurchases: number;
  totalExpenses: number;
  counterSales: number;
  counterExpenses: number;
  isLoading?: boolean;
  loadingStates: {
    parties: boolean;
    sales: boolean;
    purchases: boolean;
    expenses: boolean;
    counterSales: boolean;
    counterExpenses: boolean;
  };
}

export function useDashboardData(
  salesRange: CounterRange = "thisMonth",
  purchasesRange: CounterRange = "thisMonth",
  expensesRange: CounterRange = "thisMonth",
  counterSalesRange: CounterRange = "today",
  counterExpensesRange: CounterRange = "today"
): DashboardStats {
  const partiesData = useLiveQuery(async () => {
    try {
      const allParties = await db.parties.toArray();
      let totalBalance = 0;
      let totalPayable = 0;

      for (const p of allParties) {
        if (p.is_delete === 1 || p.status === "inactive") continue;
        const bal = Number(p.balance || 0);
        if (bal > 0) {
          totalBalance += bal;
        } else if (bal < 0) {
          totalPayable += Math.abs(bal);
        }
      }
      return {
        totalBalance: Math.round(totalBalance),
        totalPayable: Math.round(totalPayable),
      };
    } catch (err) {
      console.error("Error calculating parties stats:", err);
      return { totalBalance: 0, totalPayable: 0 };
    }
  }, []);

  const salesData = useLiveQuery(async () => {
    try {
      const allOrders = await db.orders.toArray();
      const rangeDates = getRangeDates(salesRange);
      let totalRevenue = 0;
      for (const order of allOrders) {
        const orderDate = new Date(order.created_at || order.sale_date || 0);
        if (orderDate >= rangeDates.start && orderDate <= rangeDates.end) {
          totalRevenue += Number(order.total_amount || 0);
        }
      }
      return Math.round(totalRevenue);
    } catch (err) {
      console.error("Error calculating sales stats:", err);
      return 0;
    }
  }, [salesRange]);

  const purchasesData = useLiveQuery(async () => {
    try {
      const allPurchases = await db.purchase_bills.toArray();
      const rangeDates = getRangeDates(purchasesRange);
      let totalPurchases = 0;
      for (const purchase of allPurchases) {
        const purchaseDate = new Date(purchase.created_at || purchase.date || 0);
        if (purchaseDate >= rangeDates.start && purchaseDate <= rangeDates.end) {
          totalPurchases += Number(purchase.total_amount || purchase.amount || 0);
        }
      }
      return Math.round(totalPurchases);
    } catch (err) {
      console.error("Error calculating purchases stats:", err);
      return 0;
    }
  }, [purchasesRange]);

  const expensesData = useLiveQuery(async () => {
    try {
      const allExpenses = await db.expenses.toArray();
      const rangeDates = getRangeDates(expensesRange);
      let totalExpenses = 0;
      for (const exp of allExpenses) {
        const expDate = new Date(exp.created_at || exp.date || 0);
        if (expDate >= rangeDates.start && expDate <= rangeDates.end) {
          totalExpenses += Number(exp.amount || 0);
        }
      }
      return Math.round(totalExpenses);
    } catch (err) {
      console.error("Error calculating expenses stats:", err);
      return 0;
    }
  }, [expensesRange]);

  const counterSalesData = useLiveQuery(async () => {
    try {
      const allTransactions = await db.transactions.toArray();
      const rangeDates = getRangeDates(counterSalesRange);
      let counterSales = 0;
      for (const t of allTransactions) {
        const tDate = new Date(t.created_at || t.date || t.timestamp || 0);
        if (tDate >= rangeDates.start && tDate <= rangeDates.end) {
          if ((t.type === "income" || t.type === "sale") && !t.order_id) {
            counterSales += Number(t.amount || 0);
          }
        }
      }
      return Math.round(counterSales * 100) / 100;
    } catch (err) {
      console.error("Error calculating counter sales stats:", err);
      return 0;
    }
  }, [counterSalesRange]);

  const counterExpensesData = useLiveQuery(async () => {
    try {
      const allTransactions = await db.transactions.toArray();
      const rangeDates = getRangeDates(counterExpensesRange);
      let counterExpenses = 0;
      for (const t of allTransactions) {
        const tDate = new Date(t.created_at || t.date || t.timestamp || 0);
        if (tDate >= rangeDates.start && tDate <= rangeDates.end) {
          if (t.type === "expense") {
            counterExpenses += Number(t.amount || 0);
          }
        }
      }
      return Math.round(counterExpenses * 100) / 100;
    } catch (err) {
      console.error("Error calculating counter expenses stats:", err);
      return 0;
    }
  }, [counterExpensesRange]);

  const loadingStates = {
    parties: partiesData === undefined,
    sales: salesData === undefined,
    purchases: purchasesData === undefined,
    expenses: expensesData === undefined,
    counterSales: counterSalesData === undefined,
    counterExpenses: counterExpensesData === undefined,
  };

  const isInitialLoading =
    partiesData === undefined &&
    salesData === undefined &&
    purchasesData === undefined;

  return {
    totalBalance: partiesData?.totalBalance ?? 0,
    totalPayable: partiesData?.totalPayable ?? 0,
    totalRevenue: salesData ?? 0,
    totalPurchases: purchasesData ?? 0,
    totalExpenses: expensesData ?? 0,
    counterSales: counterSalesData ?? 0,
    counterExpenses: counterExpensesData ?? 0,
    isLoading: isInitialLoading,
    loadingStates,
  };
}

