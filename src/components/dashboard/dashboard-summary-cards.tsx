"use client";

import React, { useMemo } from "react";
import { Activity, TrendingDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatCard } from "@/components/dashboard/stat-card";
import { CounterRange, DashboardStats } from "@/lib/hooks/useDashboardData";

export interface DashboardSummaryCardsProps {
  dashboardStats: DashboardStats;
  salesRange: CounterRange;
  purchasesRange: CounterRange;
  expensesRange: CounterRange;
  counterSalesRange: CounterRange;
  counterExpensesRange: CounterRange;
  setSalesRange: (v: CounterRange) => void;
  setPurchasesRange: (v: CounterRange) => void;
  setExpensesRange: (v: CounterRange) => void;
  setCounterSalesRange: (v: CounterRange) => void;
  setCounterExpensesRange: (v: CounterRange) => void;
  isPrivacyMode: boolean;
  enableCounterSale: boolean;
  currentMonthName: string;
  canViewCustomers: boolean;
  canViewSales: boolean;
  canViewPurchases: boolean;
  canViewExpenses: boolean;
  tDash: (key: string) => string;
}

export function useDashboardSummaryCards({
  dashboardStats,
  salesRange,
  purchasesRange,
  expensesRange,
  counterSalesRange,
  counterExpensesRange,
  setSalesRange,
  setPurchasesRange,
  setExpensesRange,
  setCounterSalesRange,
  setCounterExpensesRange,
  isPrivacyMode,
  enableCounterSale,
  canViewCustomers,
  canViewSales,
  canViewPurchases,
  canViewExpenses,
  tDash,
}: DashboardSummaryCardsProps) {
  return useMemo(() => {
    const renderRangeSelect = (
      value: CounterRange,
      onChange: (val: CounterRange) => void
    ) => (
      <Select value={value} onValueChange={(v) => onChange(v as CounterRange)}>
        <SelectTrigger
          className="w-20 sm:w-24 h-6 text-[10px] px-1.5 py-0 bg-transparent shadow-none border-border/60 hover:bg-accent/50 focus:ring-0"
          onClick={(e) => e.stopPropagation()}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end" className="text-xs">
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="thisWeek">This Week</SelectItem>
          <SelectItem value="lastWeek">Last Week</SelectItem>
          <SelectItem value="thisMonth">This Month</SelectItem>
          <SelectItem value="lastMonth">Last Month</SelectItem>
          <SelectItem value="ytd">Year to date</SelectItem>
        </SelectContent>
      </Select>
    );

    const cards = [
      ...(canViewCustomers
        ? [
            {
              key: "balance",
              node: (
                <StatCard
                  title={
                    tDash("totalBalanceYoullGet") ||
                    "Total Balance (You'll get)"
                  }
                  value={dashboardStats.totalBalance}
                  icon={<Activity className="w-4 h-4 sm:w-5 sm:h-5" />}
                  isPrivacy={isPrivacyMode}
                  currency="PKR"
                  isLoading={dashboardStats.loadingStates?.parties}
                />
              ),
            },
            {
              key: "payable",
              node: (
                <StatCard
                  title={tDash("totalPayable")}
                  value={dashboardStats.totalPayable}
                  icon={<TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />}
                  isPrivacy={isPrivacyMode}
                  currency="PKR"
                  isExpense
                  isLoading={dashboardStats.loadingStates?.parties}
                />
              ),
            },
          ]
        : []),
      ...(canViewSales
        ? [
            {
              key: "sales",
              node: (
                <StatCard
                  title={tDash("sales") || "Sales"}
                  value={dashboardStats.totalRevenue}
                  icon={renderRangeSelect(salesRange, setSalesRange)}
                  isPrivacy={isPrivacyMode}
                  currency="PKR"
                  isLoading={dashboardStats.loadingStates?.sales}
                  noIconBg
                />
              ),
            },
          ]
        : []),
      ...(canViewPurchases
        ? [
            {
              key: "purchases",
              node: (
                <StatCard
                  title={tDash("purchases") || "Purchases"}
                  value={dashboardStats.totalPurchases}
                  icon={renderRangeSelect(purchasesRange, setPurchasesRange)}
                  isPrivacy={isPrivacyMode}
                  currency="PKR"
                  isExpense
                  isLoading={dashboardStats.loadingStates?.purchases}
                  noIconBg
                />
              ),
            },
          ]
        : []),
      ...(canViewExpenses
        ? [
            {
              key: "expenses",
              node: (
                <StatCard
                  title={tDash("totalExpenses") || "Total Expense"}
                  value={dashboardStats.totalExpenses}
                  icon={renderRangeSelect(expensesRange, setExpensesRange)}
                  isPrivacy={isPrivacyMode}
                  currency="PKR"
                  isExpense
                  isLoading={dashboardStats.loadingStates?.expenses}
                  noIconBg
                />
              ),
            },
          ]
        : []),
      ...(canViewSales
        ? [
            {
              key: "counter-sales",
              node: (
                <StatCard
                  title={tDash("counterSales") || "Counter Sales"}
                  value={dashboardStats.counterSales}
                  icon={renderRangeSelect(
                    counterSalesRange,
                    setCounterSalesRange
                  )}
                  isPrivacy={isPrivacyMode}
                  currency="PKR"
                  isLoading={dashboardStats.loadingStates?.counterSales}
                  noIconBg
                />
              ),
            },
          ]
        : []),
      ...(canViewExpenses
        ? [
            {
              key: "counter-expenses",
              node: (
                <StatCard
                  title={tDash("counterExpenses") || "Counter Expenses"}
                  value={dashboardStats.counterExpenses}
                  icon={renderRangeSelect(
                    counterExpensesRange,
                    setCounterExpensesRange
                  )}
                  isPrivacy={isPrivacyMode}
                  currency="PKR"
                  isExpense
                  isLoading={dashboardStats.loadingStates?.counterExpenses}
                  noIconBg
                />
              ),
            },
          ]
        : []),
    ];

    return cards.filter((card) => {
      if (!enableCounterSale) {
        return card.key !== "counter-sales" && card.key !== "counter-expenses";
      }
      return true;
    });
  }, [
    dashboardStats,
    salesRange,
    purchasesRange,
    expensesRange,
    counterSalesRange,
    counterExpensesRange,
    setSalesRange,
    setPurchasesRange,
    setExpensesRange,
    setCounterSalesRange,
    setCounterExpensesRange,
    isPrivacyMode,
    tDash,
    enableCounterSale,
    canViewCustomers,
    canViewSales,
    canViewPurchases,
    canViewExpenses,
  ]);
}

