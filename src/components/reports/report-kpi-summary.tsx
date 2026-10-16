// src/components/reports/report-kpi-summary.tsx
"use client";

import React from "react";
import { StatCard } from "@/components/dashboard/stat-card";
import { cn } from "@/lib/utils";

export interface ReportKpiCardItem {
  title: string;
  value: string;
  icon: React.ReactNode;
  subValue?: string;
  isExpense?: boolean;
}

export interface ReportKpiSummaryProps {
  items: ReportKpiCardItem[];
  isLoading?: boolean;
  gridCols?: string;
}

export function ReportKpiSummary({ items, isLoading = false, gridCols }: ReportKpiSummaryProps) {
  const defaultGrid =
    items.length === 4
      ? "grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3"
      : "grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4";

  return (
    <div className={cn(defaultGrid, gridCols)}>
      {items.map((item, index) => (
        <StatCard
          key={index}
          title={item.title}
          value={item.value}
          icon={item.icon}
          subValue={item.subValue}
          isExpense={item.isExpense}
          isLoading={isLoading}
        />
      ))}
    </div>
  );
}
