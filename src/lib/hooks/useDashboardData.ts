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

export function useDashboardData(
  counterSalesRange: CounterRange = "today",
  counterExpensesRange: CounterRange = "today"
) {
  const data = useLiveQuery(
    async () => {
      try {
        // 1. Calculate Parties Balances (Receivables & Payables)
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

        // 2. Current Month Start & End for Monthly Totals
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const endOfMonth = getEndOfDay(now);

        // 3. Monthly Revenue (Orders)
        const allOrders = await db.orders.toArray();
        let totalRevenue = 0;
        for (const order of allOrders) {
          const orderDate = new Date(order.created_at || order.sale_date || 0);
          if (orderDate >= startOfMonth && orderDate <= endOfMonth) {
            totalRevenue += Number(order.total_amount || 0);
          }
        }

        // 4. Monthly Purchases (Purchase Bills)
        const allPurchases = await db.purchase_bills.toArray();
        let totalPurchases = 0;
        for (const purchase of allPurchases) {
          const purchaseDate = new Date(purchase.created_at || purchase.date || 0);
          if (purchaseDate >= startOfMonth && purchaseDate <= endOfMonth) {
            totalPurchases += Number(purchase.total_amount || purchase.amount || 0);
          }
        }

        // 5. Monthly Expenses & Transactions
        const allExpenses = await db.expenses.toArray();
        let totalExpenses = 0;
        for (const exp of allExpenses) {
          const expDate = new Date(exp.created_at || exp.date || 0);
          if (expDate >= startOfMonth && expDate <= endOfMonth) {
            totalExpenses += Number(exp.amount || 0);
          }
        }

        // 6. Transactions for Counter Sales & Counter Expenses
        const allTransactions = await db.transactions.toArray();

        const salesRangeDates = getRangeDates(counterSalesRange);
        let counterSales = 0;

        for (const t of allTransactions) {
          const tDate = new Date(t.created_at || t.date || t.timestamp || 0);
          if (tDate >= salesRangeDates.start && tDate <= salesRangeDates.end) {
            if ((t.type === "income" || t.type === "sale") && !t.order_id) {
              counterSales += Number(t.amount || 0);
            }
          }
        }

        const expensesRangeDates = getRangeDates(counterExpensesRange);
        let counterExpenses = 0;

        for (const t of allTransactions) {
          const tDate = new Date(t.created_at || t.date || t.timestamp || 0);
          if (tDate >= expensesRangeDates.start && tDate <= expensesRangeDates.end) {
            if (t.type === "expense") {
              counterExpenses += Number(t.amount || 0);
            }
          }
        }

        return {
          totalBalance: Math.round(totalBalance),
          totalPayable: Math.round(totalPayable),
          totalRevenue: Math.round(totalRevenue),
          totalPurchases: Math.round(totalPurchases),
          totalExpenses: Math.round(totalExpenses),
          counterSales: Math.round(counterSales * 100) / 100,
          counterExpenses: Math.round(counterExpenses * 100) / 100,
          isLoading: false,
        };
      } catch (error) {
        console.error("Error in useDashboardData live query:", error);
        return null;
      }
    },
    [counterSalesRange, counterExpensesRange]
  );

  return (
    data || {
      totalBalance: 0,
      totalPayable: 0,
      totalRevenue: 0,
      totalPurchases: 0,
      totalExpenses: 0,
      counterSales: 0,
      counterExpenses: 0,
      isLoading: data === undefined,
    }
  );
}

