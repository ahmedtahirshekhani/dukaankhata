"use client";

import React, { useMemo } from "react";
import { Activity, TrendingDown, TrendingUp } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatCard } from "@/components/dashboard/stat-card";
import { CounterRange } from "@/lib/hooks/useDashboardData";

export interface DashboardSummaryCardsProps {
  dashboardStats: {
    totalBalance: number;
    totalPayable: number;
    totalRevenue: number;
    totalPurchases: number;
    totalExpenses: number;
    counterSales: number;
    counterExpenses: number;
    isLoading?: boolean;
  };
  counterSalesRange: CounterRange;
  counterExpensesRange: CounterRange;
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
  counterSalesRange,
  counterExpensesRange,
  setCounterSalesRange,
  setCounterExpensesRange,
  isPrivacyMode,
  enableCounterSale,
  currentMonthName,
  canViewCustomers,
  canViewSales,
  canViewPurchases,
  canViewExpenses,
  tDash,
}: DashboardSummaryCardsProps) {
  return useMemo(() => {
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
                  isLoading={dashboardStats.isLoading}
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
                  isLoading={dashboardStats.isLoading}
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
                  title={`${tDash("sales") || "Sales"} (${currentMonthName})`}
                  value={dashboardStats.totalRevenue}
                  icon={<TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />}
                  isPrivacy={isPrivacyMode}
                  currency="PKR"
                  isLoading={dashboardStats.isLoading}
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
                  title={`${tDash("purchases")} (${currentMonthName})`}
                  value={dashboardStats.totalPurchases}
                  icon={<TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />}
                  isPrivacy={isPrivacyMode}
                  currency="PKR"
                  isExpense
                  isLoading={dashboardStats.isLoading}
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
                  title={`${
                    tDash("totalExpenses") || "Total Expense"
                  } (${currentMonthName})`}
                  value={dashboardStats.totalExpenses}
                  icon={<TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />}
                  isPrivacy={isPrivacyMode}
                  currency="PKR"
                  isExpense
                  isLoading={dashboardStats.isLoading}
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
                  icon={
                    <Select
                      value={counterSalesRange}
                      onValueChange={(v) => {
                        setCounterSalesRange(v as CounterRange);
                      }}
                    >
                      <SelectTrigger className="w-20 h-6 text-[10px] bg-transparent shadow-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="thisWeek">This Week</SelectItem>
                        <SelectItem value="lastWeek">Last Week</SelectItem>
                        <SelectItem value="thisMonth">This Month</SelectItem>
                        <SelectItem value="lastMonth">Last Month</SelectItem>
                        <SelectItem value="ytd">Year to date</SelectItem>
                      </SelectContent>
                    </Select>
                  }
                  isPrivacy={isPrivacyMode}
                  currency="PKR"
                  isLoading={dashboardStats.isLoading}
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
                  icon={
                    <Select
                      value={counterExpensesRange}
                      onValueChange={(v) => {
                        setCounterExpensesRange(v as CounterRange);
                      }}
                    >
                      <SelectTrigger className="w-20 h-6 text-[10px] bg-transparent shadow-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="thisWeek">This Week</SelectItem>
                        <SelectItem value="lastWeek">Last Week</SelectItem>
                        <SelectItem value="thisMonth">This Month</SelectItem>
                        <SelectItem value="lastMonth">Last Month</SelectItem>
                        <SelectItem value="ytd">Year to date</SelectItem>
                      </SelectContent>
                    </Select>
                  }
                  isPrivacy={isPrivacyMode}
                  currency="PKR"
                  isExpense
                  isLoading={dashboardStats.isLoading}
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
    counterSalesRange,
    counterExpensesRange,
    setCounterSalesRange,
    setCounterExpensesRange,
    currentMonthName,
    isPrivacyMode,
    tDash,
    enableCounterSale,
    canViewCustomers,
    canViewSales,
    canViewPurchases,
    canViewExpenses,
  ]);
}

